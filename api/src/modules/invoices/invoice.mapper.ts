import { Invoice, Prisma } from '@prisma/client';
import { padSequence, toMajorUnits } from '../../common/utils/money';

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: {
    billingRequest: {
      select: {
        id: true;
        title: true;
        customerName: true;
        number: true;
        createdAt: true;
        createdById: true;
      };
    };
    lineItems: true;
  };
}>;

/** Derives the human-friendly invoice number (e.g. INV-2026-0007). */
export function buildInvoiceNumber(
  invoice: Pick<Invoice, 'number' | 'issuedAt'>,
): string {
  return `INV-${invoice.issuedAt.getFullYear()}-${padSequence(invoice.number)}`;
}

export function toInvoiceResponse(invoice: InvoiceWithRelations) {
  return {
    id: invoice.id,
    invoiceNumber: buildInvoiceNumber(invoice),
    amount: toMajorUnits(invoice.amountCents),
    currency: invoice.currency,
    status: invoice.status,
    issuedAt: invoice.issuedAt,
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt,
    // Issuer snapshot
    issuerName: invoice.issuerName,
    issuerAddress: invoice.issuerAddress,
    issuerTaxId: invoice.issuerTaxId,
    issuerEmail: invoice.issuerEmail,
    issuerPhone: invoice.issuerPhone,
    // Bill-to snapshot
    billToName: invoice.billToName,
    billToAddress: invoice.billToAddress,
    billToEmail: invoice.billToEmail,
    billToPhone: invoice.billToPhone,
    // Money breakdown
    subtotal: toMajorUnits(invoice.subtotalCents),
    discount: toMajorUnits(invoice.discountCents),
    taxRatePercent: Number(invoice.taxRatePercent),
    taxAmount: toMajorUnits(invoice.taxAmountCents),
    total: toMajorUnits(invoice.totalCents),
    // Payment / bank details
    paymentTerms: invoice.paymentTerms,
    notes: invoice.notes,
    bankAccountName: invoice.bankAccountName,
    bankAccountNumber: invoice.bankAccountNumber,
    bankName: invoice.bankName,
    bankSwiftOrRouting: invoice.bankSwiftOrRouting,
    // Line items (cents converted to major units)
    lineItems: invoice.lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: toMajorUnits(item.unitPriceCents),
      amount: toMajorUnits(item.amountCents),
      sortOrder: item.sortOrder,
    })),
    billingRequest: {
      id: invoice.billingRequest.id,
      title: invoice.billingRequest.title,
      customerName: invoice.billingRequest.customerName,
    },
  };
}
