import { Invoice, Prisma } from '@prisma/client';
import { padSequence, toMajorUnits } from '../../common/utils/money';

type InvoiceWithRequest = Prisma.InvoiceGetPayload<{
  include: {
    billingRequest: {
      select: { id: true; title: true; customerName: true; number: true; createdAt: true };
    };
  };
}>;

/** Derives the human-friendly invoice number (e.g. INV-2026-0007). */
export function buildInvoiceNumber(
  invoice: Pick<Invoice, 'number' | 'issuedAt'>,
): string {
  return `INV-${invoice.issuedAt.getFullYear()}-${padSequence(invoice.number)}`;
}

export function toInvoiceResponse(invoice: InvoiceWithRequest) {
  return {
    id: invoice.id,
    invoiceNumber: buildInvoiceNumber(invoice),
    amount: toMajorUnits(invoice.amountCents),
    currency: invoice.currency,
    status: invoice.status,
    issuedAt: invoice.issuedAt,
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt,
    billingRequest: {
      id: invoice.billingRequest.id,
      title: invoice.billingRequest.title,
      customerName: invoice.billingRequest.customerName,
    },
  };
}
