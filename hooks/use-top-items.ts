import { useQuery } from '@tanstack/react-query';

export interface TopItem {
  name: string;
  count: number;
  totalSpent: number;
  totalQuantity: number;
  averagePrice: number;
  category: string | null;
  merchantCount: number;
  merchants: string[];
  lastPurchased: string;
  currency: string;
}

export interface TopItemsResponse {
  topItems: TopItem[];
  summary: {
    totalUniqueItems: number;
    totalPurchases: number;
    totalSpent: number;
    currency: string;
    /** What was spent per currency, never added across currencies. */
    totals?: Array<{ currency: string; amount: number }>;
    period: {
      startDate: string;
      endDate: string;
      months: number;
    };
  };
  sortBy: string;
}

interface UseTopItemsOptions {
  householdId?: string;
  months?: number;
  limit?: number;
  sortBy?: 'frequency' | 'spending';
  enabled?: boolean;
}

async function fetchTopItems(options: UseTopItemsOptions): Promise<TopItemsResponse> {
  const params = new URLSearchParams({
    ...(options.householdId && { householdId: options.householdId }),
    ...(options.months && { months: options.months.toString() }),
    ...(options.limit && { limit: options.limit.toString() }),
    ...(options.sortBy && { sortBy: options.sortBy }),
  });

  const response = await fetch(`/api/receipts/items/top?${params}`);

  if (!response.ok) {
    throw new Error('Failed to fetch top items');
  }

  return response.json();
}

export function useTopItems(options: UseTopItemsOptions = {}) {
  const { enabled = true, ...fetchOptions } = options;

  return useQuery({
    queryKey: ['topItems', fetchOptions],
    queryFn: () => fetchTopItems(fetchOptions),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}
