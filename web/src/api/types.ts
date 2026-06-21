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

export interface HistoryEntry {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  timestamp: string;
  timeLabel: string;
  actor: UserRef | null;
  metadata: Record<string, unknown> | null;
  statusChange?: {
    from: string | null;
    to: string | null;
  };
}

export interface HistoryDayGroup {
  date: string; // 'today', 'yesterday', or ISO date
  dateLabel: string; // 'Today', 'Yesterday', 'June 15, 2026'
  entries: HistoryEntry[];
}

export type HistoryResponse = HistoryDayGroup[];

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sortOrder: number;
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
  // Issuer snapshot
  issuerName: string | null;
  issuerAddress: string | null;
  issuerTaxId: string | null;
  issuerEmail: string | null;
  issuerPhone: string | null;
  // Bill-to snapshot
  billToName: string;
  billToAddress: string | null;
  billToEmail: string | null;
  billToPhone: string | null;
  // Money breakdown (major units)
  subtotal: number;
  discount: number;
  taxRatePercent: number;
  taxAmount: number;
  total: number;
  // Payment / bank details
  paymentTerms: string | null;
  notes: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  bankSwiftOrRouting: string | null;
  lineItems: InvoiceLineItem[];
  billingRequest: {
    id: string;
    title: string;
    customerName: string;
  };
}

export interface PIChatMessage {
  id: string;
  message: string;
  senderName: string;
  role: Role;
  createdAt: string;
}

export interface PIChatDayGroup {
  date: string;
  dateLabel: string;
  messages: PIChatMessage[];
}

export interface PIChatResponse {
  piId: string;
  chat: PIChatDayGroup[];
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

export interface PIStatusSummary {
  SUBMITTED: number;
  APPROVED: number;
  REJECTED: number;
  INVOICED: number;
}

export interface TimelineEntry {
  id: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  timestamp: string;
  timeLabel: string;
  actor: UserRef | null;
  metadata: Record<string, unknown> | null;
  billingRequest: {
    id: string;
    number: number;
    title: string;
    status: BillingRequestStatus;
  };
}

export type DailyTimelineResponse = TimelineDayGroup[];

export interface TimelineDayGroup {
  date: string; // 'today', 'yesterday', or ISO date
  dateLabel: string; // 'Today', 'Yesterday', 'June 15, 2026'
  entries: TimelineEntry[];
}

// New metrics types for daily status trends and breakdown
export interface DayStatusData {
  date: string;
  SUBMITTED: number;
  APPROVED: number;
  REJECTED: number;
  INVOICED: number;
}

export interface MonthlyTrendResponse {
  month: string;
  days: DayStatusData[];
}

export interface DailyStatusBreakdown {
  date: string;
  SUBMITTED: number;
  APPROVED: number;
  REJECTED: number;
  INVOICED: number;
}

export interface CreateBillingRequestInput {
  title: string;
  customerName: string;
  amount: number;
  currency?: string;
  description?: string;
}
