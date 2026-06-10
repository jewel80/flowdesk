import { ConflictException } from '@nestjs/common';
import { BillingRequestStatus, InvoiceStatus } from '@prisma/client';
import { InvoicesService } from './invoices.service';

function makeInvoice(overrides: Partial<any> = {}): any {
  return {
    id: 'inv-1',
    number: 1,
    amountCents: 150000,
    currency: 'USD',
    status: InvoiceStatus.ISSUED,
    issuedAt: new Date('2026-01-02T00:00:00Z'),
    dueDate: new Date('2026-02-01T00:00:00Z'),
    paidAt: null,
    billingRequestId: 'req-1',
    billingRequest: {
      id: 'req-1',
      title: 'Test',
      customerName: 'Acme',
      number: 1,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      createdById: 'sales-1',
    },
    ...overrides,
  };
}

describe('InvoicesService.generateForRequest', () => {
  let service: InvoicesService;
  let prisma: any;
  let tx: any;
  let repository: any;
  let auditService: any;
  let config: any;

  beforeEach(() => {
    tx = {
      billingRequest: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    prisma = { primary: { $transaction: jest.fn((fn: any) => fn(tx)) } };
    repository = { findByRequestId: jest.fn(), create: jest.fn() };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn().mockReturnValue(30) };

    service = new InvoicesService(prisma, repository, auditService, config);
  });

  it('is idempotent: returns the existing invoice without creating a new one', async () => {
    tx.billingRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      status: BillingRequestStatus.INVOICED,
      amountCents: 150000,
      currency: 'USD',
    });
    repository.findByRequestId.mockResolvedValue(makeInvoice());

    const result = await service.generateForRequest('req-1', 'acc-1');

    expect(repository.create).not.toHaveBeenCalled();
    expect(result.invoiceNumber).toBe('INV-2026-0001');
  });

  it('creates an invoice and moves the request to INVOICED when APPROVED', async () => {
    tx.billingRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      status: BillingRequestStatus.APPROVED,
      amountCents: 150000,
      currency: 'USD',
    });
    repository.findByRequestId.mockResolvedValue(null);
    repository.create.mockResolvedValue(makeInvoice());

    const result = await service.generateForRequest('req-1', 'acc-1');

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(tx.billingRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: BillingRequestStatus.INVOICED },
      }),
    );
    expect(result.amount).toBe(1500);
  });

  it('refuses to invoice a request that is not APPROVED', async () => {
    tx.billingRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      status: BillingRequestStatus.SUBMITTED,
      amountCents: 150000,
      currency: 'USD',
    });
    repository.findByRequestId.mockResolvedValue(null);

    await expect(
      service.generateForRequest('req-1', 'acc-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
