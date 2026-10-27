import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type WireReceipt, type WireReceiptsPage } from '@shared/api/receipts';
import { invalidateReceiptQueries } from '@shared/query/refresh';
import { api } from '../api/client';
import { type ReceiptFilterState } from '../receipts/filters';

const PAGE_SIZE = 20;
/** While a receipt is being read, look again this often; give up on one stuck longer than this. */
const POLL_MS = 3000;
const POLL_FOR_MS = 10 * 60 * 1000;

export const isBeingRead = (receipt: Pick<WireReceipt, 'processingStatus'>) =>
  receipt.processingStatus === 'pending' || receipt.processingStatus === 'processing';

const pollWhileReading = (receipts: WireReceipt[]) =>
  receipts.some((r) => isBeingRead(r) && Date.now() - Date.parse(r.createdAt) < POLL_FOR_MS) ? POLL_MS : false;

/** The list's filters; Home's recent receipts sort by when they were added. */
export type ReceiptFilters = Omit<ReceiptFilterState, 'sortBy'> & { search?: string; sortBy?: ReceiptFilterState['sortBy'] | 'created' };

/**
 * Receipts, newest first, a page at a time as the list scrolls. Under the 'receipts' key like the
 * website's, so the shared refreshes (shared/query/refresh.ts) cover it.
 */
export function useReceipts(filters: ReceiptFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['receipts', 'infinite', filters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const sortBy = filters.sortBy ?? 'date';
      const params = new URLSearchParams({ page: String(pageParam), limit: String(PAGE_SIZE), sortBy, sortOrder: filters.sortOrder ?? (sortBy === 'merchant' ? 'asc' : 'desc') });
      for (const key of ['search', 'householdId', 'category', 'merchant', 'minAmount', 'maxAmount', 'startDate', 'endDate', 'isBusinessExpense'] as const) {
        const value = filters[key];
        if (value) params.set(key, value);
      }
      return api<WireReceiptsPage>(`/api/receipts?${params}`);
    },
    getNextPageParam: (last) => (last.pagination.hasNext ? last.pagination.page + 1 : undefined),
    // Another search, filter or household: the last list stays (dimmed) until this one arrives.
    placeholderData: (previous) => previous,
    // A receipt from the app, the extension or an email is read on the server after it appears.
    refetchInterval: (query) => pollWhileReading(query.state.data?.pages.flatMap((p) => p.receipts) ?? []),
  });
}

export function useReceipt(id: string | undefined) {
  return useQuery({
    queryKey: ['receipt', id],
    queryFn: () => api<WireReceipt>(`/api/receipts/${id}`),
    enabled: !!id,
    refetchInterval: (query) => (query.state.data ? pollWhileReading([query.state.data]) : false),
  });
}

export function useRetryReceipt(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/api/receipts/${id}/retry`, { method: 'POST' }),
    onSuccess: () => invalidateReceiptQueries(queryClient),
  });
}

export function useDeleteReceipt(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/api/receipts/${id}`, { method: 'DELETE' }),
    // Its own query would only refetch a 404.
    onSuccess: () => invalidateReceiptQueries(queryClient, ['receipt', id]),
  });
}

/** Share a receipt with a household, or make it just yours (null). */
export function useAssignReceipt(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (householdId: string | null) => api(`/api/receipts/${id}/assign`, { method: 'PATCH', json: { householdId } }),
    onSuccess: () => invalidateReceiptQueries(queryClient),
  });
}

/** Mark a receipt as a business expense, or not. */
export function useSetBusinessExpense(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (isBusinessExpense: boolean) => api(`/api/receipts/${id}`, { method: 'PATCH', json: { isBusinessExpense } }),
    onSuccess: () => invalidateReceiptQueries(queryClient),
  });
}
