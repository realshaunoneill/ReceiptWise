import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReceiptWithItems } from '@/lib/types/api-responses';

interface ReceiptsResponse {
  receipts: ReceiptWithItems[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

interface ReceiptFilters {
  search?: string
  category?: string
  merchant?: string
  minAmount?: string
  maxAmount?: string
  startDate?: string
  endDate?: string
  sortBy?: string
  sortOrder?: string
  searchAllHouseholds?: boolean
}

export function useReceipts(
  householdId?: string,
  page: number = 1,
  limit: number = 10,
  filters?: ReceiptFilters,
  personalOnly: boolean = false,
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['receipts', householdId, page, limit, filters, personalOnly],
    queryFn: async (): Promise<ReceiptsResponse> => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (householdId) {
        params.append('householdId', householdId);
      }

      if (personalOnly) {
        params.append('personalOnly', 'true');
      }

      // Add filter parameters
      if (filters?.search) {
        params.append('search', filters.search);
      }
      if (filters?.category) {
        params.append('category', filters.category);
      }
      if (filters?.merchant) {
        params.append('merchant', filters.merchant);
      }
      if (filters?.minAmount) {
        params.append('minAmount', filters.minAmount);
      }
      if (filters?.maxAmount) {
        params.append('maxAmount', filters.maxAmount);
      }
      if (filters?.startDate) {
        params.append('startDate', filters.startDate);
      }
      if (filters?.endDate) {
        params.append('endDate', filters.endDate);
      }
      if (filters?.sortBy) {
        params.append('sortBy', filters.sortBy);
      }
      if (filters?.sortOrder) {
        params.append('sortOrder', filters.sortOrder);
      }

      if (filters?.searchAllHouseholds) {
        params.append('searchAllHouseholds', 'true');
      }

      const response = await fetch(`/api/receipts?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch receipts');
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - balance between freshness and performance
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on tab focus to reduce API calls
  });

  const refetch = () => {
    // Invalidate all receipt queries, regardless of filters/pagination
    // This ensures fresh data after uploads, deletions, or updates
    queryClient.invalidateQueries({
      queryKey: ['receipts'],
      refetchType: 'active',
    });
  };

  return {
    receipts: query.data?.receipts || [],
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    error: query.error,
    refetch,
  };
}

// Hook for getting recent receipts (for dashboard): the most recently *uploaded*, so a new
// upload and its processing status show up here even when the receipt itself is dated weeks ago.
const RECENT_FILTERS: ReceiptFilters = { sortBy: 'created', sortOrder: 'desc' };

export function useRecentReceipts(householdId?: string, limit: number = 5, personalOnly: boolean = false) {
  return useReceipts(householdId, 1, limit, RECENT_FILTERS, personalOnly);
}
