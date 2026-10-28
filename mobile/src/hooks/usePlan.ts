import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type WireAccount, type WireGoal, type WireIncome } from '@shared/api/finance';
import { type WirePlan } from '@shared/api/plan';
import { localToday } from '@shared/dates/local-date';
import { invalidateFinanceQueries } from '@shared/query/refresh';
import { api } from '../api/client';

/** One period of the plan (offset 0 is the current one), computed on the server. */
export function usePlan(offset = 0, householdId?: string, enabled = true) {
  return useQuery({
    queryKey: ['plan', offset, householdId ?? null],
    enabled,
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

export type EntryChange = { done?: boolean; amount?: string; label?: string; date?: string; direction?: 'out' | 'in'; category?: string | null; notes?: string | null };

export function useUpdateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EntryChange }) => api(`/api/plan/entries/${id}`, { method: 'PATCH', json: data }),
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

/**
 * One month's pay or savings at a different amount (PUT /api/plan/amounts); amount null is back to
 * the usual. `day` is the payday for pay, and the period's first day for savings.
 */
export type PlanAmountChange = { source: 'income' | 'goal'; sourceId: string; day: string; amount: string | null };

export function useSetPlanAmount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (change: PlanAmountChange) => api('/api/plan/amounts', { method: 'PUT', json: change }),
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

// ----- One-off lines -----

export type EntryInput = {
  date: string;
  label: string;
  amount: string;
  direction?: 'out' | 'in';
  category?: string | null;
  done?: boolean;
  notes?: string | null;
  householdId?: string | null;
};

export function useCreateEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entries: EntryInput[]) => api('/api/plan/entries', { method: 'POST', json: { entries } }),
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/plan/entries/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

// ----- Income, savings goals and accounts (same keys as the website's lib/hooks/use-plan.ts) -----

const scoped = (path: string, householdId?: string) => (householdId ? `${path}?householdId=${encodeURIComponent(householdId)}` : path);

export function useIncome(householdId?: string) {
  return useQuery({ queryKey: ['income', householdId ?? null], queryFn: () => api<WireIncome[]>(scoped('/api/income', householdId)) });
}

export type IncomeInput = {
  name: string;
  amount: string;
  frequency: string;
  payDay: number | null;
  anchorDate: string | null;
  weekendRule: string;
  isPrimary: boolean;
  intoAccountId: string | null;
  householdId?: string | null;
};

export function useSaveIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Partial<IncomeInput> }) =>
      api<WireIncome>(id ? `/api/income/${id}` : '/api/income', { method: id ? 'PATCH' : 'POST', json: data }),
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useDeleteIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/income/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useGoals(householdId?: string) {
  return useQuery({ queryKey: ['goals', householdId ?? null], queryFn: () => api<WireGoal[]>(scoped('/api/goals', householdId)) });
}

export type GoalInput = {
  name: string;
  contributionPerCycle: string | null;
  targetAmount: string | null;
  targetDate: string | null;
  savedAmount: string;
  linkedAccountId: string | null;
  householdId?: string | null;
};

export function useSaveGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Partial<GoalInput> }) =>
      api<WireGoal>(id ? `/api/goals/${id}` : '/api/goals', { method: id ? 'PATCH' : 'POST', json: data }),
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/goals/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useAccounts(householdId?: string) {
  return useQuery({ queryKey: ['accounts', householdId ?? null], queryFn: () => api<WireAccount[]>(scoped('/api/accounts', householdId)) });
}

export type AccountInput = { name: string; kind: 'current' | 'savings' | 'cash'; includeInPlan: boolean; householdId?: string | null; balance?: string; asOfDate?: string };

export function useSaveAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Partial<AccountInput> }) => {
      if (id) {
        const { balance: _balance, asOfDate: _asOfDate, ...rest } = data;
        return api(`/api/accounts/${id}`, { method: 'PATCH', json: rest });
      }
      return api(`/api/accounts?today=${localToday()}`, { method: 'POST', json: data });
    },
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useArchiveAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/accounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function useRecordBalances() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (balances: Array<{ accountId: string; balance: string; asOfDate: string }>) => api('/api/accounts/balances', { method: 'POST', json: { balances } }),
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}
