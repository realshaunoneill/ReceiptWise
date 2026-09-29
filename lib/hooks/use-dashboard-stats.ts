import { useQuery } from '@tanstack/react-query';
import { useRecentReceipts } from './use-receipts';

export interface ReceiptStats {
  totalReceipts: number;
  totalItems: number;
  totalSpent: number;
  avgSpending: number;
  spendingByCategory: Array<{ category: string; amount: number; percentage: number }>;
  points?: Array<{ date: string; amount: number; category: string | null }>;
}

/**
 * Server-computed receipt totals (see /api/receipts/stats).
 *
 * The query key sits under ['receipts'] so every existing
 * invalidateQueries({ queryKey: ['receipts'] }) after an upload, retry or delete refreshes it too.
 */
export function useReceiptStats(
  householdId?: string,
  personalOnly: boolean = false,
  from?: string,
) {
  return useQuery({
    queryKey: ['receipts', 'stats', householdId ?? null, personalOnly, from ?? null],
    queryFn: async (): Promise<ReceiptStats> => {
      const params = new URLSearchParams();
      if (householdId) params.append('householdId', householdId);
      if (personalOnly) params.append('personalOnly', 'true');
      if (from) params.append('from', from);
      const response = await fetch(`/api/receipts/stats?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load receipt stats');
      }
      return response.json();
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useDashboardStats(householdId?: string, personalOnly: boolean = false) {
  // Totals come from the server: computing them here from the first 100 receipts made every
  // figure wrong past 100, and counted pending, failed and not-a-receipt uploads as €0.00 spends.
  const { data, isLoading: statsLoading } = useReceiptStats(householdId, personalOnly);
  // The list below the tiles still shows the latest uploads, whatever their status.
  const { receipts: recentReceipts, isLoading: receiptsLoading } = useRecentReceipts(householdId, 5, personalOnly);

  const stats = {
    totalReceipts: data?.totalReceipts ?? 0,
    totalItems: data?.totalItems ?? 0,
    totalSpent: data?.totalSpent ?? 0,
    // Total divided by number of receipts: the mean *per receipt*, not per day.
    avgSpending: data?.avgSpending ?? 0,
    topCategory: data?.spendingByCategory[0]?.category ?? 'No data',
    spendingByCategory: data?.spendingByCategory ?? [],
    recentReceipts,
  };

  return {
    stats,
    isLoading: statsLoading || receiptsLoading,
    error: null,
  };
}
