import { BillingRequest, Prisma } from '@prisma/client';
import { padSequence, toMajorUnits } from '../../common/utils/money';
import { availableActions } from './workflow';

type BillingRequestWithRelations = Prisma.BillingRequestGetPayload<{
  include: {
    createdBy: { select: { id: true; name: true; role: true } };
    reviewedBy: { select: { id: true; name: true; role: true } };
    invoice: true;
  };
}>;

/** Derives the human-friendly reference (e.g. BR-2026-0007) from the sequence. */
export function buildReference(request: Pick<BillingRequest, 'number' | 'createdAt'>): string {
  return `BR-${request.createdAt.getFullYear()}-${padSequence(request.number)}`;
}

/**
 * Maps a persisted billing request to the API response shape: money in major
 * units, a readable reference, and the structurally-available next actions.
 */
export function toBillingRequestResponse(request: BillingRequestWithRelations) {
  return {
    id: request.id,
    reference: buildReference(request),
    title: request.title,
    customerName: request.customerName,
    amount: toMajorUnits(request.amountCents),
    currency: request.currency,
    description: request.description,
    status: request.status,
    rejectionReason: request.rejectionReason,
    createdBy: request.createdBy,
    reviewedBy: request.reviewedBy,
    reviewedAt: request.reviewedAt,
    invoiceId: request.invoice?.id ?? null,
    availableActions: availableActions(request.status),
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}
