import { useSyncExternalStore } from 'react';

/**
 * The receipts list's filters, shared by the list and its Filters sheet (app/sheets/receipt-filters).
 * The same ones as the website's Filters sheet, plus which receipts: your own, or a household's.
 * Kept while the app runs; a fresh launch starts unfiltered.
 */
export type ReceiptFilterState = {
  householdId?: string;
  category?: string;
  merchant?: string;
  minAmount?: string;
  maxAmount?: string;
  startDate?: string;
  endDate?: string;
  /** 'true' for business expenses only, 'false' for personal only. */
  isBusinessExpense?: 'true' | 'false';
  sortBy?: 'date' | 'amount' | 'merchant';
  sortOrder?: 'asc' | 'desc';
};

let current: ReceiptFilterState = {};
const listeners = new Set<() => void>();

export function setReceiptFilters(next: ReceiptFilterState) {
  current = next;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const read = () => current;

export function useReceiptFilters(): ReceiptFilterState {
  return useSyncExternalStore(subscribe, read, read);
}

/** How many filters narrow the list (the sort and the household don't count). */
export function activeFilterCount(filters: ReceiptFilterState): number {
  const { householdId: _household, sortBy: _sortBy, sortOrder: _sortOrder, ...rest } = filters;
  return Object.values(rest).filter(Boolean).length;
}

export const SORT_ORDERS = {
  date: { desc: 'Newest first', asc: 'Oldest first', default: 'desc' },
  amount: { desc: 'Highest first', asc: 'Lowest first', default: 'desc' },
  merchant: { asc: 'A–Z', desc: 'Z–A', default: 'asc' },
} as const;
