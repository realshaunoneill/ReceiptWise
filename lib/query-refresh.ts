import { type QueryClient, type QueryKey } from '@tanstack/react-query';

/**
 * Invalidate every query under each of `keys`, and resolve once the ones on screen have refetched.
 * A mutation that returns this from onSuccess stays pending until the page shows its change, so
 * nothing closes or re-enables on the old figures.
 *
 * `except` leaves out one query: a removed item's own query would only refetch a 404, with
 * retries, and hold the mutation waiting on it for seconds.
 */
export function refreshQueries(queryClient: QueryClient, keys: readonly string[], except?: QueryKey): Promise<void> {
  // Each key once: invalidating a query twice cancels and restarts its fetch.
  return Promise.all(
    [...new Set(keys)].map((key) =>
      queryClient.invalidateQueries({
        queryKey: [key],
        predicate: except ? (query) => !except.every((part, index) => query.queryKey[index] === part) : undefined,
      })),
  ).then(() => undefined);
}
