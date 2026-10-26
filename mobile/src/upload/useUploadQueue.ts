import { useSyncExternalStore } from 'react';
import { getQueue, isOnline, subscribe } from './runner';
import { queueSummary } from './queue';

/** The captures waiting, uploading or stuck, and a line saying so ("Uploading 2 of 5"). */
export function useUploadQueue() {
  const items = useSyncExternalStore(subscribe, getQueue, getQueue);
  const online = useSyncExternalStore(subscribe, isOnline, isOnline);
  return { items, online, summary: queueSummary(items, online) };
}
