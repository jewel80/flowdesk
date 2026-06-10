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
  DemoUser,
  Invoice,
  MetricsSummary,
  Paginated,
  WorkflowAction,
} from './types';

export interface RequestFilter {
  status?: string;
  mine?: boolean;
}

export const queryKeys = {
  metrics: ['metrics'] as const,
  requests: (filter: RequestFilter) => ['requests', filter] as const,
  request: (id: string) => ['request', id] as const,
  audit: (id: string) => ['audit', id] as const,
  invoices: ['invoices'] as const,
  invoice: (id: string) => ['invoice', id] as const,
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
      const params: Record<string, string> = {};
      if (filter.status) params.status = filter.status;
      if (filter.mine) params.mine = 'true';
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

export function useInvoices() {
  return useQuery({
    queryKey: queryKeys.invoices,
    queryFn: async () => (await api.get<Invoice[]>('/invoices')).data,
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: queryKeys.invoice(id),
    queryFn: async () => (await api.get<Invoice>(`/invoices/${id}`)).data,
    enabled: Boolean(id),
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
      void qc.invalidateQueries({ queryKey: queryKeys.invoices });
      void qc.invalidateQueries({ queryKey: queryKeys.invoice(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.metrics });
    },
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
  void qc.invalidateQueries({ queryKey: queryKeys.invoices });
}
