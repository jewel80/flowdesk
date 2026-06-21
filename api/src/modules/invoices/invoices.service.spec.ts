import { ConflictException } from '@nestjs/common';
import { BillingRequestStatus, InvoiceStatus } from '@prisma/client';
import { toInvoiceResponse } from './invoice.mapper';
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
    // Issuer/bill-to snapshot
    issuerName: 'FlowDesk Inc.',
    issuerAddress: '123 Business St, San Francisco, CA 94105',
    issuerTaxId: null,
    issuerEmail: 'billing@flowdesk.com',
    issuerPhone: null,
    billToName: 'Acme Corp',
    billToAddress: null,
    billToEmail: null,
    billToPhone: null,
    // Money breakdown
    subtotalCents: 150000,
    discountCents: 0,
    taxRatePercent: 0,
    taxAmountCents: 0,
    totalCents: 150000,
    // Payment details
    paymentTerms: 'Net 30',
    notes: null,
    bankAccountName: null,
    bankAccountNumber: null,
    bankName: null,
    bankSwiftOrRouting: null,
    // Line items
    lineItems: [
      {
        id: 'li-1',
        description: 'Test',
        quantity: 1,
        unitPriceCents: 150000,
        amountCents: 150000,
        sortOrder: 0,
      },
    ],
    ...overrides,
  };
}

// ── InvoicesService.generateForRequest ────────────────────────────────────────

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
      title: 'Q3 Services',
      description: null,
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

  it('sets totalCents = amountCents when discount and tax are both zero', async () => {
    tx.billingRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      title: 'Cloud Infrastructure',
      description: null,
      status: BillingRequestStatus.APPROVED,
      amountCents: 250000,
      currency: 'USD',
    });
    repository.findByRequestId.mockResolvedValue(null);

    let capturedData: any;
    repository.create.mockImplementation(async (data: any) => {
      capturedData = data;
      return makeInvoice({
        amountCents: data.amountCents,
        subtotalCents: data.subtotalCents,
        discountCents: data.discountCents,
        taxAmountCents: data.taxAmountCents,
        totalCents: data.totalCents,
      });
    });

    const result = await service.generateForRequest('req-1', 'acc-1');

    expect(capturedData.subtotalCents).toBe(250000);
    expect(capturedData.discountCents).toBe(0);
    expect(capturedData.taxAmountCents).toBe(0);
    expect(capturedData.totalCents).toBe(250000);
    expect(result.total).toBe(2500);
  });
});

// ── toInvoiceResponse — money/totals mapper ───────────────────────────────────

describe('invoice totals — toInvoiceResponse mapper', () => {
  it('converts every money field from cents to major units', () => {
    const inv = makeInvoice({
      subtotalCents: 10000,
      discountCents: 500,
      taxRatePercent: 10,
      taxAmountCents: 950,
      totalCents: 10450,
    });
    const r = toInvoiceResponse(inv);
    expect(r.subtotal).toBe(100);
    expect(r.discount).toBe(5);
    expect(r.taxRatePercent).toBe(10);
    expect(r.taxAmount).toBe(9.5);
    expect(r.total).toBe(104.5);
  });

  it('handles 1-cent value without floating-point drift', () => {
    const inv = makeInvoice({ subtotalCents: 1, totalCents: 1, discountCents: 0, taxAmountCents: 0 });
    const r = toInvoiceResponse(inv);
    expect(r.subtotal).toBe(0.01);
    expect(r.total).toBe(0.01);
  });

  it('handles odd cents: 3 cents = $0.03', () => {
    const inv = makeInvoice({ subtotalCents: 3, totalCents: 3, discountCents: 0, taxAmountCents: 0 });
    const r = toInvoiceResponse(inv);
    expect(r.subtotal).toBe(0.03);
  });

  it('maps line items from cents to major units', () => {
    const inv = makeInvoice({
      lineItems: [
        { id: 'li-1', description: 'Widget', quantity: 3, unitPriceCents: 1099, amountCents: 3297, sortOrder: 0 },
        { id: 'li-2', description: 'Setup fee', quantity: 1, unitPriceCents: 500, amountCents: 500, sortOrder: 1 },
      ],
    });
    const r = toInvoiceResponse(inv);
    expect(r.lineItems).toHaveLength(2);
    expect(r.lineItems[0].unitPrice).toBe(10.99);
    expect(r.lineItems[0].amount).toBe(32.97);
    expect(r.lineItems[1].unitPrice).toBe(5);
    expect(r.lineItems[1].amount).toBe(5);
  });

  it('preserves subtotal - discount + tax = total when caller provides consistent data', () => {
    const inv = makeInvoice({
      subtotalCents: 10000,
      discountCents: 100,
      taxAmountCents: 990,
      totalCents: 10890,
    });
    const r = toInvoiceResponse(inv);
    expect(r.subtotal - r.discount + r.taxAmount).toBeCloseTo(r.total, 10);
  });
});
