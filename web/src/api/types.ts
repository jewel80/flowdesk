export type Role = 'SALES' | 'ACCOUNTS' | 'MANAGER';

export type BillingRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'INVOICED';

export type InvoiceStatus = 'ISSUED' | 'PAID' | 'VOID';

export type WorkflowAction = 'submit' | 'approve' | 'reject' | 'resubmit';

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  role: Role;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface UserRef {
  id: string;
  name: string;
  role: Role;
}

export interface BillingRequest {
  id: string;
  reference: string;
  title: string;
  customerName: string;
  amount: number;
  currency: string;
  description: string | null;
  status: BillingRequestStatus;
  rejectionReason: string | null;
  createdBy: UserRef;
  reviewedBy: UserRef | null;
  reviewedAt: string | null;
  invoiceId: string | null;
  availableActions: WorkflowAction[];
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditEntry {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  metadata: Record<string, unknown> | null;
  actor: UserRef | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
  paidAt: string | null;
  billingRequest: {
    id: string;
    title: string;
    customerName: string;
  };
}

export interface MetricsSummary {
  scope: 'self' | 'organisation';
  requests: {
    total: number;
    byStatus: Record<BillingRequestStatus, number>;
    pendingReview: number;
  };
  invoices: {
    outstandingCount: number;
    outstandingAmount: number;
    paidCount: number;
    paidAmount: number;
  };
}

export interface CreateBillingRequestInput {
  title: string;
  customerName: string;
  amount: number;
  currency?: string;
  description?: string;
}
