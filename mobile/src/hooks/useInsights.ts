import { useQuery } from '@tanstack/react-query';
import { type WireItemHistory, type WireReceiptStats, type WireSpendingSummary, type WireTopItems } from '@shared/api/insights';
import { api } from '../api/client';
import { analyseItem } from '../insights/items';

/**
 * Totals and insights, with the website's keys (lib/hooks/use-dashboard-stats.ts and hooks/*), so
 * the shared refreshes cover them: an upload, a retry or a deletion refreshes everything under
 * 'receipts'. A household, or none for every receipt you added.
 */

const withHousehold = (params: Record<string, string>, householdId?: string) =>
  new URLSearchParams(householdId ? { ...params, householdId } : params);

/** Completed receipts' totals; with `from`, a point per receipt since then (for the trends). */
export function useReceiptStats(householdId?: string, from?: string) {
  return useQuery({
    queryKey: ['receipts', 'stats', householdId ?? null, false, from ?? null],
    queryFn: () => api<WireReceiptStats>(`/api/receipts/stats?${withHousehold(from ? { from } : {}, householdId)}`),
    placeholderData: (previous) => previous,
  });
}

/**
 * The written summary for the last `months`: one AI call each, so only fetched once asked for
 * (`enabled`), then kept for the visit; the server keeps it for 24 hours too.
 */
export function useSpendingSummary(householdId: string | undefined, months: number, enabled: boolean) {
  return useQuery({
    queryKey: ['spendingSummary', { householdId, months }],
    queryFn: () => api<WireSpendingSummary>(`/api/receipts/items/summary?${withHousehold({ months: String(months) }, householdId)}`),
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useTopItems(householdId: string | undefined, months: number, sortBy: 'frequency' | 'spending') {
  return useQuery({
    queryKey: ['topItems', { householdId, months, sortBy, limit: 20 }],
    queryFn: () => api<WireTopItems>(`/api/receipts/items/top?${withHousehold({ months: String(months), sortBy, limit: '20' }, householdId)}`),
    placeholderData: (previous) => previous,
  });
}

/** One item over the last year: every kind of it, where it was bought, and the receipts. */
export function useItemAnalysis(itemName: string, householdId: string | undefined, fallbackCurrency: string) {
  return useQuery({
    queryKey: ['itemAnalysis', itemName, { householdId, months: 12 }],
    queryFn: async () => {
      const [top, history] = await Promise.all([
        api<WireTopItems>(`/api/receipts/items/top?${withHousehold({ limit: '200', sortBy: 'frequency', months: '12' }, householdId)}`),
        // The receipts are a nice-to-have: the analysis stands without them.
        api<WireItemHistory>(`/api/receipts/items/history?${withHousehold({ itemName, limit: '10', months: '12' }, householdId)}`).catch(() => null),
      ]);
      return analyseItem(itemName, top.topItems, history?.purchases ?? [], fallbackCurrency);
    },
    enabled: !!itemName,
    staleTime: 5 * 60 * 1000,
  });
}
