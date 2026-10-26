import { FINANCE_QUERY_KEYS, RECEIPT_QUERY_KEYS } from './keys';

/**
 * The parts of TanStack Query's QueryClient this uses, written out so shared/ imports no package
 * (the website and the app each bring their own @tanstack/react-query).
 */
type QueryKey = readonly unknown[];
export type InvalidatingClient = {
  invalidateQueries(filters: { queryKey: QueryKey; predicate?: (query: { queryKey: QueryKey }) => boolean }): Promise<void>;
};

/**
 * Invalidate every query under each of `keys`, and resolve once the ones on screen have refetched.
 * A mutation that returns this from onSuccess stays pending until the page shows its change, so
 * nothing closes or re-enables on the old figures.
 *
 * `except` leaves out one query: a removed item's own query would only refetch a 404, with
 * retries, and hold the mutation waiting on it for seconds.
 */
export function refreshQueries(queryClient: InvalidatingClient, keys: readonly string[], except?: QueryKey): Promise<void> {
  // Each key once: invalidating a query twice cancels and restarts its fetch.
  return Promise.all(
    [...new Set(keys)].map((key) =>
      queryClient.invalidateQueries({
        queryKey: [key],
        predicate: except ? (query) => !except.every((part, index) => query.queryKey[index] === part) : undefined,
      })),
  ).then(() => undefined);
}

/**
 * Refresh everything a receipt feeds, after one is added, read, changed or removed: the lists and
 * totals (all under 'receipts'), one receipt, the insights, and the plan's spending this period.
 * `except`: the query of a removed receipt.
 */
export function invalidateReceiptQueries(queryClient: InvalidatingClient, except?: QueryKey): Promise<void> {
  return refreshQueries(queryClient, RECEIPT_QUERY_KEYS, except);
}

/**
 * Refresh everything the plan is computed from, after any change to one of them.
 * `except`: the query of something just removed.
 */
export function invalidateFinanceQueries(queryClient: InvalidatingClient, except?: QueryKey): Promise<void> {
  return refreshQueries(queryClient, FINANCE_QUERY_KEYS, except);
}
