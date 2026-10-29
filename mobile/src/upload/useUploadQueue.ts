import { useMemo, useSyncExternalStore } from 'react';
import { useAccounts } from '../auth/accounts';
import { getQueue, isOnline, subscribe } from './runner';
import { itemsFor, queueSummary } from './queue';

/**
 * The captures of the account on screen waiting, uploading or stuck, and a line saying so
 * ("Uploading 2 of 5"). Another account's carry on uploading without showing here.
 */
export function useUploadQueue() {
  const all = useSyncExternalStore(subscribe, getQueue, getQueue);
  const online = useSyncExternalStore(subscribe, isOnline, isOnline);
  const { active } = useAccounts();
  const items = useMemo(() => itemsFor(all, active), [all, active]);
  return { items, online, summary: queueSummary(items, online) };
}
