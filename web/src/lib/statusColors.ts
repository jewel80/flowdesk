export const STATUS_COLORS = {
  SUBMITTED: '#f59e0b',
  APPROVED: '#10b981',
  REJECTED: '#ef4444',
  INVOICED: '#3b82f6',
} as const;

export type StatusColorKey = keyof typeof STATUS_COLORS;

export const STATUS_LABELS: Record<StatusColorKey, string> = {
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  INVOICED: 'Invoiced',
};
