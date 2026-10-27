import { useCallback, useRef, useState } from 'react';

/**
 * Pull to refresh's spinner, shown only while a refresh the person pulled for runs. Tying it to a
 * query's isRefetching showed it for every background look (coming back to the app, a refresh
 * after a change, the bill inbox's polling), and iOS left it stuck on screen when that happened
 * on a tab that wasn't showing.
 */
export function usePullToRefresh(refresh: (() => unknown) | undefined) {
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(refresh);
  latest.current = refresh;
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.resolve(latest.current?.()).catch(() => undefined).finally(() => setRefreshing(false));
  }, []);
  return { refreshing, onRefresh };
}
