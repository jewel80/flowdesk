/** Centralised queue and job identifiers shared by producers and consumers. */
export const INVOICE_QUEUE = 'invoice';

export const INVOICE_JOBS = {
  GENERATE: 'generate-invoice',
} as const;

export interface GenerateInvoiceJobData {
  billingRequestId: string;
  /** The user who approved the request (for the audit trail). */
  approvedByUserId: string;
}
