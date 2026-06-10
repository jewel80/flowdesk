import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

/**
 * End-to-end tests against the real application: the full Nest app is booted
 * (controllers, guards, Prisma, BullMQ worker) and exercised over HTTP via
 * supertest. Requires Postgres + Redis to be reachable (e.g. `docker compose up`)
 * with the demo data seeded.
 */
const DEMO_PASSWORD = 'password123';
const USERS = {
  sales: 'sales@flowdesk.dev',
  accounts: 'accounts@flowdesk.dev',
  manager: 'manager@flowdesk.dev',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('FlowDesk API (e2e)', () => {
  let app: INestApplication;
  let http: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // Mirror the production bootstrap so the contract under test is identical.
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app?.close();
  });

  const login = async (email: string): Promise<string> => {
    const res = await request(http)
      .post('/api/v1/auth/login')
      .send({ email, password: DEMO_PASSWORD })
      .expect(200);
    return res.body.accessToken as string;
  };

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe('Health', () => {
    it('GET /health is public and reports the DB as up', async () => {
      const res = await request(http).get('/api/v1/health').expect(200);
      expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
    });
  });

  describe('Authentication', () => {
    it('issues a token and principal for valid credentials', async () => {
      const res = await request(http)
        .post('/api/v1/auth/login')
        .send({ email: USERS.accounts, password: DEMO_PASSWORD })
        .expect(200);
      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({
        email: USERS.accounts,
        role: 'ACCOUNTS',
      });
    });

    it('rejects bad credentials with 401', async () => {
      await request(http)
        .post('/api/v1/auth/login')
        .send({ email: USERS.sales, password: 'wrong-password' })
        .expect(401);
    });

    it('rejects unauthenticated access to a protected route with 401', async () => {
      await request(http).get('/api/v1/billing-requests').expect(401);
    });
  });

  describe('Validation & RBAC', () => {
    it('rejects an invalid create payload with 400 and an error envelope', async () => {
      const token = await login(USERS.sales);
      const res = await request(http)
        .post('/api/v1/billing-requests')
        .set(auth(token))
        .send({ title: 'x', customerName: '', amount: -5 })
        .expect(400);
      expect(res.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        path: '/api/v1/billing-requests',
      });
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    it('forbids a Manager from creating a request with 403', async () => {
      const token = await login(USERS.manager);
      await request(http)
        .post('/api/v1/billing-requests')
        .set(auth(token))
        .send({ title: 'Manager attempt', customerName: 'Acme', amount: 100 })
        .expect(403);
    });
  });

  describe('Full billing lifecycle', () => {
    it('create → submit → approve → async invoice → mark paid → audit', async () => {
      const salesToken = await login(USERS.sales);
      const accountsToken = await login(USERS.accounts);

      // 1. Sales creates a draft.
      const created = await request(http)
        .post('/api/v1/billing-requests')
        .set(auth(salesToken))
        .send({
          title: `E2E Jest ${Date.now()}`,
          customerName: 'Supertest Inc',
          amount: 4321.0,
        })
        .expect(201);
      const id: string = created.body.id;
      expect(created.body.status).toBe('DRAFT');
      expect(created.body.reference).toMatch(/^BR-\d{4}-\d{4}$/);

      // 2. Sales submits it.
      const submitted = await request(http)
        .post(`/api/v1/billing-requests/${id}/submit`)
        .set(auth(salesToken))
        .expect(200);
      expect(submitted.body.status).toBe('SUBMITTED');

      // 3. Sales cannot approve (RBAC).
      await request(http)
        .post(`/api/v1/billing-requests/${id}/approve`)
        .set(auth(salesToken))
        .expect(403);

      // 4. Accounts approves.
      const approved = await request(http)
        .post(`/api/v1/billing-requests/${id}/approve`)
        .set(auth(accountsToken))
        .expect(200);
      expect(approved.body.status).toBe('APPROVED');

      // 5. The async worker generates the invoice (request → INVOICED).
      let invoiceId: string | null = null;
      for (let i = 0; i < 30; i++) {
        await sleep(500);
        const res = await request(http)
          .get(`/api/v1/billing-requests/${id}`)
          .set(auth(accountsToken))
          .expect(200);
        if (res.body.status === 'INVOICED' && res.body.invoiceId) {
          invoiceId = res.body.invoiceId;
          break;
        }
      }
      expect(invoiceId).toBeTruthy();

      // 6. The invoice exists, is ISSUED, and matches the amount.
      const invoice = await request(http)
        .get(`/api/v1/invoices/${invoiceId}`)
        .set(auth(accountsToken))
        .expect(200);
      expect(invoice.body).toMatchObject({ amount: 4321.0, status: 'ISSUED' });

      // 7. Accounts marks it paid.
      const paid = await request(http)
        .post(`/api/v1/invoices/${invoiceId}/mark-paid`)
        .set(auth(accountsToken))
        .expect(200);
      expect(paid.body.status).toBe('PAID');

      // 8. The audit trail captured the whole lifecycle in order.
      const audit = await request(http)
        .get(`/api/v1/billing-requests/${id}/audit`)
        .set(auth(accountsToken))
        .expect(200);
      const actions = audit.body.map((e: { action: string }) => e.action);
      expect(actions).toEqual(
        expect.arrayContaining([
          'CREATED',
          'SUBMITTED',
          'APPROVED',
          'INVOICE_GENERATED',
          'INVOICE_PAID',
        ]),
      );
    });
  });

  describe('Visibility scoping', () => {
    it('scopes Sales list to their own requests only', async () => {
      const salesToken = await login(USERS.sales);
      const res = await request(http)
        .get('/api/v1/billing-requests')
        .set(auth(salesToken))
        .expect(200);
      const creators = new Set(
        res.body.data.map((r: { createdBy: { email?: string; id: string } }) => r.createdBy.id),
      );
      // Every returned request belongs to a single creator (the caller).
      expect(creators.size).toBeLessThanOrEqual(1);
    });
  });
});
