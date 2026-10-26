import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type WirePlan } from '@shared/api/plan';
import { localToday } from '@shared/dates/local-date';
import { invalidateFinanceQueries } from '@shared/query/refresh';
import { api } from '../api/client';

/** One period of the plan (offset 0 is the current one), computed on the server. */
export function usePlan(offset = 0, householdId?: string) {
  return useQuery({
    queryKey: ['plan', offset, householdId ?? null],
    queryFn: () => {
      // The phone's own today: the server accepts it within a day of its UTC date.
      const params = new URLSearchParams({ offset: String(offset), today: localToday() });
      if (householdId) params.set('householdId', householdId);
      return api<WirePlan>(`/api/plan?${params}`);
    },
    placeholderData: (previous) => previous,
  });
}

/** A bill's occurrence this period: paid, not paid, skipped, missed, or its amount. */
export type OccurrenceChange = {
  status?: 'pending' | 'paid' | 'missed' | 'skipped';
  actualDate?: string | null;
  actualAmount?: string | null;
  expectedAmount?: string;
};

export function useUpdateOccurrence(subscriptionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expectedDate, data }: { expectedDate: string; data: OccurrenceChange }) =>
      api(`/api/subscriptions/${subscriptionId}/occurrences`, { method: 'PUT', json: { expectedDate, ...data } }),
    // Pending until the plan on screen has caught up, so the tick never flickers back.
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export type EntryChange = { done?: boolean; amount?: string; label?: string; date?: string };

export function useUpdateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EntryChange }) => api(`/api/plan/entries/${id}`, { method: 'PATCH', json: data }),
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useAddContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, amount, contributedOn }: { goalId: string; amount: string; contributedOn: string }) =>
      api(`/api/goals/${goalId}/contributions`, { method: 'POST', json: { amount, contributedOn } }),
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useRemoveContributions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, contributionIds }: { goalId: string; contributionIds: string[] }) => {
      for (const id of contributionIds) await api(`/api/goals/${goalId}/contributions/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}
