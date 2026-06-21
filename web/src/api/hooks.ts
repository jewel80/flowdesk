import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from './client';
import type {
  AuditEntry,
  BillingRequest,
  CreateBillingRequestInput,
  DailyTimelineResponse,
  DemoUser,
  HistoryResponse,
  Invoice,
  MetricsSummary,
  MonthlyTrendResponse,
  DailyStatusBreakdown,
  Paginated,
  PIChatResponse,
  PIStatusSummary,
  WorkflowAction,
} from './types';

export interface RequestFilter {
  status?: string;
  mine?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const queryKeys = {
  metrics: ['metrics'] as const,
  requests: (filter: RequestFilter) => ['requests', filter] as const,
  request: (id: string) => ['request', id] as const,
  audit: (id: string) => ['audit', id] as const,
  history: (id: string) => ['history', id] as const,
  piChat: (id: string) => ['pi-chat', id] as const,
  invoice: (id: string) => ['invoice', id] as const,
  dashboard: ['dashboard'] as const,
  dashboardTimeline: (days: number) => ['dashboard-timeline', days] as const,
  dailyStatusTrend: (month: string) => ['daily-status-trend', month] as const,
  dailyStatusBreakdown: (date: string) => ['daily-status-breakdown', date] as const,
};

export function useDemoUsers() {
  return useQuery({
    queryKey: ['demo-users'],
    queryFn: async () => (await api.get<DemoUser[]>('/auth/demo-users')).data,
  });
}

export function useMetrics() {
  return useQuery({
    queryKey: queryKeys.metrics,
    queryFn: async () =>
      (await api.get<MetricsSummary>('/metrics/summary')).data,
  });
}

export function useBillingRequests(filter: RequestFilter) {
  return useQuery({
    queryKey: queryKeys.requests(filter),
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (filter.status) params.status = filter.status;
      if (filter.mine) params.mine = 'true';
      if (filter.search) params.search = filter.search;
      if (filter.page) params.page = filter.page;
      if (filter.pageSize) params.pageSize = filter.pageSize;
      return (
        await api.get<Paginated<BillingRequest>>('/billing-requests', { params })
      ).data;
    },
  });
}

export function useBillingRequest(id: string) {
  return useQuery({
    queryKey: queryKeys.request(id),
    queryFn: async () =>
      (await api.get<BillingRequest>(`/billing-requests/${id}`)).data,
    enabled: Boolean(id),
  });
}

export function useAuditTrail(id: string) {
  return useQuery({
    queryKey: queryKeys.audit(id),
    queryFn: async () =>
      (await api.get<AuditEntry[]>(`/billing-requests/${id}/audit`)).data,
    enabled: Boolean(id),
  });
}

export function useHistory(id: string) {
  return useQuery({
    queryKey: queryKeys.history(id),
    queryFn: async () =>
      (await api.get<HistoryResponse>(`/billing-requests/${id}/history`)).data,
    enabled: Boolean(id),
  });
}

export function useInvoices(filter?: { search?: string; page?: number }) {
  const search = filter?.search || '';
  const page = filter?.page || 1;

  return useQuery({
    queryKey: ['invoices', search, page] as const,
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (filter?.search) params.search = filter.search;
      if (filter?.page) params.page = filter.page;
      return (
        await api.get<Paginated<Invoice>>('/invoices', { params })
      ).data;
    },
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: queryKeys.invoice(id),
    queryFn: async () => (await api.get<Invoice>(`/invoices/${id}`)).data,
    enabled: Boolean(id),
  });
}

export function usePIChat(invoiceId: string) {
  return useQuery({
    queryKey: queryKeys.piChat(invoiceId),
    queryFn: async () =>
      (await api.get<PIChatResponse>(`/invoices/${invoiceId}/pi-chat`)).data,
    enabled: Boolean(invoiceId),
  });
}

export function useSendPIChatMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceId, message }: { invoiceId: string; message: string }) =>
      (await api.post<PIChatResponse>(`/invoices/${invoiceId}/pi-chat`, { message })).data,
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: queryKeys.piChat(variables.invoiceId) });
    },
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBillingRequestInput) =>
      (await api.post<BillingRequest>('/billing-requests', input)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['requests'] });
      void qc.invalidateQueries({ queryKey: queryKeys.metrics });
    },
  });
}

export function useUpdateRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CreateBillingRequestInput>) =>
      (await api.patch<BillingRequest>(`/billing-requests/${id}`, input)).data,
    onSuccess: () => invalidateRequest(qc, id),
  });
}

export interface ActionInput {
  id: string;
  action: WorkflowAction;
  reason?: string;
}

export function useRequestAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, reason }: ActionInput) => {
      const body = action === 'reject' ? { reason } : undefined;
      return (
        await api.post<BillingRequest>(`/billing-requests/${id}/${action}`, body)
      ).data;
    },
    onSuccess: (_data, variables) => invalidateRequest(qc, variables.id),
  });
}

export function useMarkInvoicePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<Invoice>(`/invoices/${id}/mark-paid`)).data,
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['invoices'] });
      void qc.invalidateQueries({ queryKey: queryKeys.invoice(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.metrics });
    },
  });
}

export function usePIStatusSummary() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async () =>
      (await api.get<PIStatusSummary>('/dashboard/status-summary')).data,
  });
}

export function useDashboardTimeline(days: number = 30) {
  return useQuery({
    queryKey: queryKeys.dashboardTimeline(days),
    queryFn: async () =>
      (await api.get<DailyTimelineResponse>('/dashboard/daily-timeline', {
        params: { days },
      })).data,
  });
}

export function useDailyStatusTrend(month?: string) {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const selectedMonth = month || currentMonth;

  return useQuery({
    queryKey: queryKeys.dailyStatusTrend(selectedMonth),
    queryFn: async () =>
      (await api.get<MonthlyTrendResponse>('/metrics/daily-status-trend', {
        params: { month: selectedMonth },
      })).data,
  });
}

export function useDailyStatusBreakdown(date?: string) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const selectedDate = date || today;

  return useQuery({
    queryKey: queryKeys.dailyStatusBreakdown(selectedDate),
    queryFn: async () =>
      (await api.get<DailyStatusBreakdown>('/metrics/daily-status-breakdown', {
        params: { date: selectedDate },
      })).data,
  });
}

function invalidateRequest(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
): void {
  void qc.invalidateQueries({ queryKey: ['requests'] });
  void qc.invalidateQueries({ queryKey: queryKeys.request(id) });
  void qc.invalidateQueries({ queryKey: queryKeys.audit(id) });
  void qc.invalidateQueries({ queryKey: queryKeys.metrics });
  void qc.invalidateQueries({ queryKey: ['invoices'] });
}
