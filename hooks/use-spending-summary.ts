import { useQuery } from '@tanstack/react-query';

export interface SpendingSummary {
  summary: string;
  data: {
    period: {
      startDate: string;
      endDate: string;
      months: number;
    };
    statistics: {
      totalItems: number;
      totalSpent: number;
      currency: string;
      averagePerItem: number;
      /** Bought in these too, but not in the money figures (there's no conversion). */
      otherCurrencies?: string[];
    };
    topItems: Array<{
      name: string;
      count: number;
    }>;
    topCategories: Array<{
      category: string;
      total: number;
    }>;
    topMerchants: Array<{
      merchant: string;
      total: number;
    }>;
  };
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface UseSpendingSummaryOptions {
  householdId?: string;
  months?: number;
  enabled?: boolean;
}

async function fetchSpendingSummary(options: UseSpendingSummaryOptions): Promise<SpendingSummary> {
  const params = new URLSearchParams({
    ...(options.householdId && { householdId: options.householdId }),
    ...(options.months && { months: options.months.toString() }),
  });

  const response = await fetch(`/api/receipts/items/summary?${params}`);

  if (!response.ok) {
    throw new Error('Failed to fetch spending summary');
  }

  return response.json();
}

export function useSpendingSummary(options: UseSpendingSummaryOptions = {}) {
  const { enabled = true, ...fetchOptions } = options;

  return useQuery({
    queryKey: ['spendingSummary', fetchOptions],
    queryFn: () => fetchSpendingSummary(fetchOptions),
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes (AI responses are expensive)
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}
