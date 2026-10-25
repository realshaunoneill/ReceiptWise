'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { type FinancialAccount, type IncomeSource, type PlanEntry, type SavingsGoal } from '@/lib/db/schema';
import { localToday } from '@/lib/dates/local-date';
import { refreshQueries } from '@/lib/query-refresh';
import { type PlanResponse } from '@/lib/services/plan-service';

/**
 * Client hooks for the monthly plan: the plan itself, income, one-off entries, savings goals and
 * accounts. Every change refreshes the plan and the lists it is built from.
 */

export type AccountWithBalance = FinancialAccount & { latestBalance: { balance: string; asOfDate: string } | null };

export const FINANCE_QUERY_KEYS = ['plan', 'subscriptions', 'subscription', 'income', 'goals', 'accounts'] as const;

/**
 * Refresh everything the plan is computed from, after any change to one of them, and resolve once
 * the page shows it (see refreshQueries). `except`: the query of something just removed.
 */
export function invalidateFinanceQueries(queryClient: QueryClient, except?: QueryKey): Promise<void> {
  return refreshQueries(queryClient, FINANCE_QUERY_KEYS, except);
}

/** Throw the server's `{ error }` message so toasts say what went wrong. */
async function fetchJson<T>(url: string, init?: RequestInit, fallback = 'Something went wrong'): Promise<T> {
  const res = await fetch(url, init && { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: unknown } | null;
    throw new Error(typeof body?.error === 'string' ? body.error : fallback);
  }
  return res.json() as Promise<T>;
}

function scopeQuery(householdId?: string) {
  return householdId ? `householdId=${encodeURIComponent(householdId)}` : '';
}

function useFinanceMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Returned, so the mutation is pending until the plan on screen has caught up.
    onSuccess: () => invalidateFinanceQueries(queryClient),
  });
}

export function usePlan({ offset = 0, householdId, enabled = true }: { offset?: number; householdId?: string; enabled?: boolean }) {
  return useQuery<PlanResponse>({
    queryKey: ['plan', offset, householdId ?? null],
    queryFn: () => {
      const params = new URLSearchParams({ offset: String(offset), today: localToday() });
      if (householdId) params.set('householdId', householdId);
      return fetchJson<PlanResponse>(`/api/plan?${params}`, undefined, 'Failed to load the plan');
    },
    enabled,
    placeholderData: (previous) => previous,
  });
}

// ----- One-off entries -----

export type EntryInput = {
  date: string;
  label: string;
  amount: string | number;
  direction?: 'out' | 'in';
  category?: string | null;
  done?: boolean;
  notes?: string | null;
  householdId?: string | null;
};

export function useCreateEntries() {
  return useFinanceMutation((entries: EntryInput[]) =>
    fetchJson<PlanEntry[]>('/api/plan/entries', { method: 'POST', body: JSON.stringify({ entries }) }, 'Failed to add to the plan'));
}

export function useUpdateEntry() {
  return useFinanceMutation(({ id, data }: { id: string; data: Partial<EntryInput> }) =>
    fetchJson<PlanEntry>(`/api/plan/entries/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, 'Failed to update'));
}

export function useDeleteEntry() {
  return useFinanceMutation((id: string) =>
    fetchJson<{ success: boolean }>(`/api/plan/entries/${id}`, { method: 'DELETE' }, 'Failed to delete'));
}

// ----- Income -----

export type IncomeInput = {
  name: string;
  amount: string | number;
  currency?: string;
  frequency: string;
  payDay?: number | null;
  anchorDate?: string | null;
  weekendRule?: string;
  isPrimary?: boolean;
  status?: 'active' | 'ended';
  householdId?: string | null;
};

export function useIncome(householdId?: string, enabled = true) {
  return useQuery<IncomeSource[]>({
    queryKey: ['income', householdId ?? null],
    queryFn: () => fetchJson<IncomeSource[]>(`/api/income?${scopeQuery(householdId)}`, undefined, 'Failed to load income'),
    enabled,
  });
}

export function useSaveIncome() {
  return useFinanceMutation(({ id, data }: { id?: string; data: Partial<IncomeInput> }) =>
    fetchJson<IncomeSource>(id ? `/api/income/${id}` : '/api/income', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(data),
    }, 'Failed to save income'));
}

export function useDeleteIncome() {
  return useFinanceMutation((id: string) =>
    fetchJson<{ success: boolean }>(`/api/income/${id}`, { method: 'DELETE' }, 'Failed to delete income'));
}

// ----- Savings goals -----

export type GoalInput = {
  name: string;
  targetAmount?: string | number | null;
  targetDate?: string | null;
  contributionPerCycle?: string | number | null;
  savedAmount?: string | number;
  status?: 'active' | 'paused' | 'achieved' | 'archived';
  householdId?: string | null;
};

export function useGoals(householdId?: string, enabled = true) {
  return useQuery<SavingsGoal[]>({
    queryKey: ['goals', householdId ?? null],
    queryFn: () => fetchJson<SavingsGoal[]>(`/api/goals?${scopeQuery(householdId)}`, undefined, 'Failed to load goals'),
    enabled,
  });
}

export function useSaveGoal() {
  return useFinanceMutation(({ id, data }: { id?: string; data: Partial<GoalInput> }) =>
    fetchJson<SavingsGoal>(id ? `/api/goals/${id}` : '/api/goals', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(data),
    }, 'Failed to save the goal'));
}

export function useDeleteGoal() {
  return useFinanceMutation((id: string) =>
    fetchJson<{ success: boolean }>(`/api/goals/${id}`, { method: 'DELETE' }, 'Failed to delete the goal'));
}

export function useAddContribution() {
  return useFinanceMutation(({ goalId, amount, contributedOn }: { goalId: string; amount: string | number; contributedOn: string }) =>
    fetchJson(`/api/goals/${goalId}/contributions`, { method: 'POST', body: JSON.stringify({ amount, contributedOn }) }, 'Failed to record it'));
}

export function useRemoveContributions() {
  return useFinanceMutation(async ({ goalId, contributionIds }: { goalId: string; contributionIds: string[] }) => {
    for (const id of contributionIds) {
      await fetchJson(`/api/goals/${goalId}/contributions/${id}`, { method: 'DELETE' }, 'Failed to undo it');
    }
  });
}

// ----- Accounts and balances -----

export type AccountInput = {
  name: string;
  kind?: 'current' | 'savings' | 'cash';
  includeInPlan?: boolean;
  institution?: string | null;
  householdId?: string | null;
  balance?: string | number;
  asOfDate?: string;
};

export function useAccounts(householdId?: string) {
  return useQuery<AccountWithBalance[]>({
    queryKey: ['accounts', householdId ?? null],
    queryFn: () => fetchJson<AccountWithBalance[]>(`/api/accounts?${scopeQuery(householdId)}`, undefined, 'Failed to load accounts'),
  });
}

export function useSaveAccount() {
  return useFinanceMutation(({ id, data }: { id?: string; data: Partial<AccountInput> }) => {
    if (id) {
      const { balance: _balance, asOfDate: _asOfDate, ...rest } = data;
      return fetchJson<FinancialAccount>(`/api/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(rest) }, 'Failed to save the account');
    }
    return fetchJson<FinancialAccount>(`/api/accounts?today=${localToday()}`, { method: 'POST', body: JSON.stringify(data) }, 'Failed to save the account');
  });
}

export function useArchiveAccount() {
  return useFinanceMutation((id: string) =>
    fetchJson<{ success: boolean }>(`/api/accounts/${id}`, { method: 'DELETE' }, 'Failed to remove the account'));
}

export function useRecordBalances() {
  return useFinanceMutation((balances: Array<{ accountId: string; balance: string | number; asOfDate: string }>) =>
    fetchJson('/api/accounts/balances', { method: 'POST', body: JSON.stringify({ balances }) }, 'Failed to save balances'));
}
