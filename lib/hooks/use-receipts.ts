import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateReceiptQueries } from '@/shared/query/refresh';
import type { ReceiptWithItems } from '@/lib/types/api-responses';

export { RECEIPT_QUERY_KEYS } from '@/shared/query/keys';
export { invalidateReceiptQueries } from '@/shared/query/refresh';

/** While a receipt is being read, look again this often; give up on one stuck for longer than this. */
const PROCESSING_POLL_MS = 3000;
const PROCESSING_POLL_FOR_MS = 10 * 60 * 1000;

function isBeingRead(receipt: ReceiptWithItems): boolean {
  return receipt.processingStatus === 'pending' || receipt.processingStatus === 'processing';
}

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
  /** 'true' for business expenses only, 'false' for personal only. */
  isBusinessExpense?: string
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

      // The filter's "Business expenses only" was set in the UI but never sent, so it did nothing.
      if (filters?.isBusinessExpense) {
        params.append('isBusinessExpense', filters.isBusinessExpense);
      }

      const response = await fetch(`/api/receipts?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch receipts');
      }
      return response.json();
    },
    gcTime: 10 * 60 * 1000,
    // A receipt from the extension or a forwarded email is read on the server after it appears,
    // so look again until it's done, as the bill inbox does.
    refetchInterval: (query) =>
      query.state.data?.receipts.some((receipt) =>
        isBeingRead(receipt) && Date.now() - new Date(receipt.createdAt).getTime() < PROCESSING_POLL_FOR_MS)
        ? PROCESSING_POLL_MS
        : false,
  });

  // When one finishes being read, its amount reaches the totals, insights and plan too.
  const beingReadKey = (query.data?.receipts ?? []).filter(isBeingRead).map((receipt) => receipt.id).join(',');
  const previouslyBeingRead = useRef<string[]>([]);
  useEffect(() => {
    const now = beingReadKey ? beingReadKey.split(',') : [];
    const finished = previouslyBeingRead.current.some((id) => !now.includes(id));
    previouslyBeingRead.current = now;
    if (finished) void invalidateReceiptQueries(queryClient);
  }, [beingReadKey, queryClient]);

  // Every receipt query, whatever its filters or page, and what receipts feed.
  const refetch = () => invalidateReceiptQueries(queryClient);

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
