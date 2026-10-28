import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type WireBill, type WireBillDetail, type WireInboxDocument, type WirePayment } from '@shared/api/bills';
import { type WireReceiptsPage } from '@shared/api/receipts';
import { addDays } from '@shared/dates/local-date';
import { FINANCE_QUERY_KEYS } from '@shared/query/keys';
import { invalidateFinanceQueries, refreshQueries } from '@shared/query/refresh';
import { api } from '../api/client';

export type BillStatus = 'active' | 'paused' | 'cancelled';

/**
 * Bills and subscriptions, soonest due first. With `includePayments`, each also says how many
 * payments are past due and not marked paid, and lists its unsettled ones. Same key shape as the
 * website's.
 */
export function useBills(status: BillStatus = 'active', householdId?: string, includePayments = false) {
  return useQuery({
    queryKey: ['subscriptions', householdId, status, includePayments],
    queryFn: () => {
      const params = new URLSearchParams({ status });
      if (householdId) params.set('householdId', householdId);
      if (includePayments) params.set('includePayments', 'true');
      return api<Array<WireBill & { missingPayments?: number; recentPayments?: WirePayment[] }>>(`/api/subscriptions?${params}`);
    },
    // Another status or household: the last list stays (dimmed) until this one arrives.
    placeholderData: (previous) => previous,
  });
}

/**
 * Every bill whatever its status, for what the Bills tab offers: the Active, Paused and Cancelled
 * switch only once something is paused or cancelled.
 */
export function useAllBills(householdId?: string) {
  return useQuery({
    queryKey: ['subscriptions', householdId, 'all', false],
    queryFn: () => api<WireBill[]>(`/api/subscriptions${householdId ? `?householdId=${encodeURIComponent(householdId)}` : ''}`),
  });
}

/** One bill: its last 24 occurrences and the bills filed against it. */
export function useBill(id: string | undefined) {
  return useQuery({
    queryKey: ['subscription', id],
    queryFn: () => api<WireBillDetail>(`/api/subscriptions/${id}`),
    enabled: !!id,
  });
}

/** What a bill is made or edited with (the website's create/edit dialogs, lib/validation/finance.ts). */
export type BillInput = {
  name: string;
  description: string | null;
  category: string | null;
  amount: string;
  currency: string;
  billingFrequency: string;
  billingDay: number;
  customFrequencyDays: number | null;
  startDate: string;
  endDate: string | null;
  householdId: string | null;
  isBusinessExpense: boolean;
  website: string | null;
  notes: string | null;
  kind: 'bill' | 'subscription';
  amountType: 'fixed' | 'variable';
  paymentMethod: string | null;
  paidFromAccountId: string | null;
  status: 'active' | 'paused' | 'cancelled';
};

export function useCreateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<BillInput>) => api<WireBill>('/api/subscriptions', { method: 'POST', json: data }),
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useUpdateBill(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<BillInput>) => api<WireBill>(`/api/subscriptions/${id}`, { method: 'PATCH', json: data }),
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useDeleteBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/subscriptions/${id}`, { method: 'DELETE' }),
    // Not the deleted one's own key: refetching it would 404.
    onSuccess: (_data, id) => invalidateFinanceQueries(queryClient, ['subscription', id]),
  });
}

export type PaymentChange = {
  receiptId?: string;
  status?: 'pending' | 'paid' | 'missed' | 'skipped' | 'cancelled';
  actualDate?: string | null;
  actualAmount?: string | null;
  expectedAmount?: string;
  dueDate?: string | null;
  notes?: string | null;
};

/** One occurrence by id: link a receipt, or change its status or amounts. */
export function useUpdatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, data }: { paymentId: string; data: PaymentChange }) => api(`/api/subscriptions/payments/${paymentId}`, { method: 'PATCH', json: data }),
    // The bill and the plan, and the receipt it links (its detail shows the bill).
    onSuccess: () => refreshQueries(queryClient, [...FINANCE_QUERY_KEYS, 'receipts', 'receipt']),
  });
}

/** Take the receipt off an occurrence (it goes back to not paid). */
export function useUnlinkPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => api(`/api/subscriptions/payments/${paymentId}`, { method: 'DELETE' }),
    onSuccess: () => refreshQueries(queryClient, [...FINANCE_QUERY_KEYS, 'receipts', 'receipt']),
  });
}

/** Receipts this many days either side of an occurrence are offered for linking. */
const MATCH_WINDOW_DAYS = 10;

/**
 * Receipts that could have paid an occurrence: those within ten days of it, or with `search`,
 * any matching it (searched on the server, so older ones can be found too).
 */
export function useLinkCandidates(around: string | null, search: string) {
  return useQuery({
    queryKey: ['receipts', 'link-candidates', around, search],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('search', search);
      else if (around) {
        params.set('startDate', addDays(around, -MATCH_WINDOW_DAYS));
        params.set('endDate', addDays(around, MATCH_WINDOW_DAYS));
      }
      return api<WireReceiptsPage>(`/api/receipts?${params}`).then((page) => page.receipts);
    },
    placeholderData: (previous) => previous,
  });
}

// ----- The bill inbox: bills brought in by the app, the website or email -----

const isReading = (documents: WireInboxDocument[] | undefined) =>
  !!documents?.some((document) => document.processingStatus === 'pending' || document.processingStatus === 'processing');

/** Bills waiting to be filed, being read, or filed automatically in the last few days. Polls while any is being read. */
export function useBillInbox(householdId?: string) {
  return useQuery({
    queryKey: ['bill-documents', 'review', householdId ?? null],
    queryFn: () => {
      const params = new URLSearchParams({ review: 'true' });
      if (householdId) params.set('householdId', householdId);
      return api<WireInboxDocument[]>(`/api/bills/documents?${params}`);
    },
    refetchInterval: (query) => (isReading(query.state.data) ? 3000 : false),
  });
}

export type ApplyBillAction =
  | { action: 'match'; subscriptionId: string; amount?: 'due' | 'minimum' }
  | { action: 'new_bill'; name?: string; billingFrequency?: string }
  | { action: 'one_off'; label?: string }
  | { action: 'dismiss' };

function useInboxMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ['bill-documents'] }), invalidateFinanceQueries(queryClient)]),
  });
}

export function useApplyBill() {
  return useInboxMutation(({ id, action }: { id: string; action: ApplyBillAction }) => api(`/api/bills/documents/${id}/apply`, { method: 'POST', json: action }));
}

export function useRetryBillDocument() {
  return useInboxMutation((id: string) => api(`/api/bills/documents/${id}/retry`, { method: 'POST' }));
}

export function useDeleteBillDocument() {
  return useInboxMutation((id: string) => api(`/api/bills/documents/${id}`, { method: 'DELETE' }));
}
