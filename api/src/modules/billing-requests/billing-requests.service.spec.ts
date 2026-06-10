import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AuditAction, BillingRequestStatus, Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { BillingRequestsService } from './billing-requests.service';
import { INVOICE_JOBS } from '../queue/queue.constants';

/** Builds a persisted-request shape (with relations) for repository mocks. */
function makeRequest(overrides: Partial<any> = {}): any {
  return {
    id: 'req-1',
    number: 1,
    title: 'Test request',
    customerName: 'Acme',
    amountCents: 150000,
    currency: 'USD',
    description: null,
    status: BillingRequestStatus.DRAFT,
    rejectionReason: null,
    createdById: 'sales-1',
    createdBy: { id: 'sales-1', name: 'Sara', role: Role.SALES },
    reviewedById: null,
    reviewedBy: null,
    reviewedAt: null,
    invoice: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

const salesOwner: AuthenticatedUser = {
  userId: 'sales-1',
  email: 'sara@flowdesk.dev',
  role: Role.SALES,
  name: 'Sara',
};
const otherSales: AuthenticatedUser = {
  userId: 'sales-2',
  email: 'samir@flowdesk.dev',
  role: Role.SALES,
  name: 'Samir',
};
const accounts: AuthenticatedUser = {
  userId: 'acc-1',
  email: 'aaron@flowdesk.dev',
  role: Role.ACCOUNTS,
  name: 'Aaron',
};

describe('BillingRequestsService', () => {
  let service: BillingRequestsService;
  let repository: any;
  let auditService: any;
  let invoiceQueue: any;

  beforeEach(() => {
    repository = {
      // Run the transactional callback with a dummy tx client.
      transaction: jest.fn((fn: any) => fn({})),
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      findManyWithCount: jest.fn(),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    invoiceQueue = { add: jest.fn().mockResolvedValue(undefined) };

    service = new BillingRequestsService(repository, auditService, invoiceQueue);
  });

  describe('create', () => {
    it('creates a DRAFT and records a CREATED audit entry', async () => {
      repository.create.mockResolvedValue(makeRequest());

      const result = await service.create(
        { title: 'Test request', customerName: 'Acme', amount: 1500 },
        salesOwner,
      );

      expect(repository.create).toHaveBeenCalledTimes(1);
      // amount (major units) is converted to cents for persistence.
      expect(repository.create.mock.calls[0][0]).toMatchObject({
        amountCents: 150000,
        status: BillingRequestStatus.DRAFT,
      });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.CREATED }),
        expect.anything(),
      );
      expect(result.reference).toBe('BR-2026-0001');
      expect(result.amount).toBe(1500);
    });
  });

  describe('approve', () => {
    it('moves SUBMITTED -> APPROVED and enqueues invoice generation', async () => {
      repository.findById.mockResolvedValue(
        makeRequest({ status: BillingRequestStatus.SUBMITTED }),
      );
      repository.update.mockResolvedValue(
        makeRequest({ status: BillingRequestStatus.APPROVED }),
      );

      const result = await service.approve('req-1', accounts);

      expect(repository.update).toHaveBeenCalledWith(
        'req-1',
        expect.objectContaining({ status: BillingRequestStatus.APPROVED }),
        expect.anything(),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.APPROVED }),
        expect.anything(),
      );
      expect(invoiceQueue.add).toHaveBeenCalledWith(
        INVOICE_JOBS.GENERATE,
        expect.objectContaining({
          billingRequestId: 'req-1',
          approvedByUserId: 'acc-1',
        }),
      );
      expect(result.status).toBe(BillingRequestStatus.APPROVED);
    });

    it('rejects approval when the request is not SUBMITTED', async () => {
      repository.findById.mockResolvedValue(
        makeRequest({ status: BillingRequestStatus.DRAFT }),
      );

      await expect(service.approve('req-1', accounts)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(invoiceQueue.add).not.toHaveBeenCalled();
    });

    it('forbids a SALES user from approving', async () => {
      repository.findById.mockResolvedValue(
        makeRequest({ status: BillingRequestStatus.SUBMITTED }),
      );

      await expect(service.approve('req-1', salesOwner)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('submit', () => {
    it('forbids submitting a request the user does not own', async () => {
      repository.findById.mockResolvedValue(
        makeRequest({ status: BillingRequestStatus.DRAFT, createdById: 'sales-1' }),
      );

      await expect(service.submit('req-1', otherSales)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('reject', () => {
    it('records the rejection reason and moves to REJECTED', async () => {
      repository.findById.mockResolvedValue(
        makeRequest({ status: BillingRequestStatus.SUBMITTED }),
      );
      repository.update.mockResolvedValue(
        makeRequest({
          status: BillingRequestStatus.REJECTED,
          rejectionReason: 'Incomplete',
        }),
      );

      await service.reject('req-1', 'Incomplete', accounts);

      expect(repository.update).toHaveBeenCalledWith(
        'req-1',
        expect.objectContaining({
          status: BillingRequestStatus.REJECTED,
          rejectionReason: 'Incomplete',
        }),
        expect.anything(),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.REJECTED,
          note: 'Incomplete',
        }),
        expect.anything(),
      );
    });
  });
});
