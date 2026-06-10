/* eslint-disable no-console */
import {
  AuditAction,
  BillingRequestStatus,
  InvoiceStatus,
  PrismaClient,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Shared demo password for every seeded account. */
const DEMO_PASSWORD = 'password123';

async function main(): Promise<void> {
  console.log('Seeding FlowDesk demo data...');

  // Idempotent: wipe transactional data so re-running yields a clean dataset.
  await prisma.auditLog.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.billingRequest.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const [sara, samir, aaron, maria] = await Promise.all([
    upsertUser('sales@flowdesk.dev', 'Sara (Sales)', Role.SALES, passwordHash),
    upsertUser('sales2@flowdesk.dev', 'Samir (Sales)', Role.SALES, passwordHash),
    upsertUser('accounts@flowdesk.dev', 'Aaron (Accounts)', Role.ACCOUNTS, passwordHash),
    upsertUser('manager@flowdesk.dev', 'Maria (Manager)', Role.MANAGER, passwordHash),
  ]);

  // 1. A fresh draft owned by Sara.
  await createRequest({
    title: 'Q2 Consulting Retainer',
    customerName: 'Northwind Traders',
    amountCents: 450000,
    description: 'Monthly retainer for advisory services.',
    status: BillingRequestStatus.DRAFT,
    createdBy: sara,
    trail: [{ action: AuditAction.CREATED, actor: sara, toStatus: BillingRequestStatus.DRAFT }],
  });

  // 2. Submitted by Samir, awaiting Accounts review.
  await createRequest({
    title: 'Annual License Renewal',
    customerName: 'Contoso Ltd',
    amountCents: 1280000,
    description: 'Renewal of 40 enterprise seats.',
    status: BillingRequestStatus.SUBMITTED,
    createdBy: samir,
    trail: [
      { action: AuditAction.CREATED, actor: samir, toStatus: BillingRequestStatus.DRAFT },
      {
        action: AuditAction.SUBMITTED,
        actor: samir,
        fromStatus: BillingRequestStatus.DRAFT,
        toStatus: BillingRequestStatus.SUBMITTED,
      },
    ],
  });

  // 3. Rejected by Aaron with a reason (Sara can revise).
  await createRequest({
    title: 'On-site Training Workshop',
    customerName: 'Fabrikam Inc',
    amountCents: 320000,
    description: 'Two-day on-site workshop for the ops team.',
    status: BillingRequestStatus.REJECTED,
    createdBy: sara,
    reviewedBy: aaron,
    rejectionReason: 'Missing the signed SOW reference. Please attach and resubmit.',
    trail: [
      { action: AuditAction.CREATED, actor: sara, toStatus: BillingRequestStatus.DRAFT },
      {
        action: AuditAction.SUBMITTED,
        actor: sara,
        fromStatus: BillingRequestStatus.DRAFT,
        toStatus: BillingRequestStatus.SUBMITTED,
      },
      {
        action: AuditAction.REJECTED,
        actor: aaron,
        fromStatus: BillingRequestStatus.SUBMITTED,
        toStatus: BillingRequestStatus.REJECTED,
        note: 'Missing the signed SOW reference. Please attach and resubmit.',
      },
    ],
  });

  // 4. Approved + invoiced, invoice still ISSUED (outstanding).
  await createRequest({
    title: 'Cloud Migration - Phase 1',
    customerName: 'Adventure Works',
    amountCents: 2750000,
    description: 'Lift-and-shift of the billing subsystem.',
    status: BillingRequestStatus.INVOICED,
    createdBy: samir,
    reviewedBy: aaron,
    invoice: { status: InvoiceStatus.ISSUED },
    trail: [
      { action: AuditAction.CREATED, actor: samir, toStatus: BillingRequestStatus.DRAFT },
      {
        action: AuditAction.SUBMITTED,
        actor: samir,
        fromStatus: BillingRequestStatus.DRAFT,
        toStatus: BillingRequestStatus.SUBMITTED,
      },
      {
        action: AuditAction.APPROVED,
        actor: aaron,
        fromStatus: BillingRequestStatus.SUBMITTED,
        toStatus: BillingRequestStatus.APPROVED,
      },
      {
        action: AuditAction.INVOICE_GENERATED,
        actor: aaron,
        fromStatus: BillingRequestStatus.APPROVED,
        toStatus: BillingRequestStatus.INVOICED,
        note: 'Invoice generated',
      },
    ],
  });

  // 5. Approved + invoiced + paid (full happy path).
  await createRequest({
    title: 'Security Audit Engagement',
    customerName: 'Tailspin Toys',
    amountCents: 980000,
    description: 'Independent penetration test and report.',
    status: BillingRequestStatus.INVOICED,
    createdBy: sara,
    reviewedBy: aaron,
    invoice: { status: InvoiceStatus.PAID },
    trail: [
      { action: AuditAction.CREATED, actor: sara, toStatus: BillingRequestStatus.DRAFT },
      {
        action: AuditAction.SUBMITTED,
        actor: sara,
        fromStatus: BillingRequestStatus.DRAFT,
        toStatus: BillingRequestStatus.SUBMITTED,
      },
      {
        action: AuditAction.APPROVED,
        actor: aaron,
        fromStatus: BillingRequestStatus.SUBMITTED,
        toStatus: BillingRequestStatus.APPROVED,
      },
      {
        action: AuditAction.INVOICE_GENERATED,
        actor: aaron,
        fromStatus: BillingRequestStatus.APPROVED,
        toStatus: BillingRequestStatus.INVOICED,
        note: 'Invoice generated',
      },
      { action: AuditAction.INVOICE_PAID, actor: aaron, note: 'Invoice marked as paid' },
    ],
  });

  console.log('Seed complete. Demo accounts (password: %s):', DEMO_PASSWORD);
  console.table([
    { email: sara.email, role: sara.role },
    { email: samir.email, role: samir.role },
    { email: aaron.email, role: aaron.role },
    { email: maria.email, role: maria.role },
  ]);
}

function upsertUser(
  email: string,
  name: string,
  role: Role,
  passwordHash: string,
) {
  return prisma.user.upsert({
    where: { email },
    update: { name, role, passwordHash },
    create: { email, name, role, passwordHash },
  });
}

interface TrailEntry {
  action: AuditAction;
  actor: { id: string };
  fromStatus?: BillingRequestStatus;
  toStatus?: BillingRequestStatus;
  note?: string;
}

interface SeedRequestInput {
  title: string;
  customerName: string;
  amountCents: number;
  description?: string;
  status: BillingRequestStatus;
  createdBy: { id: string };
  reviewedBy?: { id: string };
  rejectionReason?: string;
  invoice?: { status: InvoiceStatus };
  trail: TrailEntry[];
}

async function createRequest(input: SeedRequestInput): Promise<void> {
  const request = await prisma.billingRequest.create({
    data: {
      title: input.title,
      customerName: input.customerName,
      amountCents: input.amountCents,
      currency: 'USD',
      description: input.description,
      status: input.status,
      rejectionReason: input.rejectionReason,
      createdById: input.createdBy.id,
      reviewedById: input.reviewedBy?.id,
      reviewedAt: input.reviewedBy ? new Date() : undefined,
    },
  });

  if (input.invoice) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    await prisma.invoice.create({
      data: {
        amountCents: input.amountCents,
        currency: 'USD',
        status: input.invoice.status,
        dueDate,
        paidAt: input.invoice.status === InvoiceStatus.PAID ? new Date() : null,
        billingRequestId: request.id,
      },
    });
  }

  for (const entry of input.trail) {
    await prisma.auditLog.create({
      data: {
        billingRequestId: request.id,
        action: entry.action,
        actorId: entry.actor.id,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        note: entry.note,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
