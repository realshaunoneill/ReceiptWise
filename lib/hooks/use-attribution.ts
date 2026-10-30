'use client';

import { useSyncExternalStore } from 'react';
import { attributionQuery, visitAttribution } from '@/shared/attribution';

const noChanges = () => () => {};
const fromThisVisit = () => attributionQuery(visitAttribution(window.location.search, document.referrer, window.location.hostname));
const onTheServer = () => '';

/**
 * "?src=…&cmp=…" for this visit's sign-up and sign-in links (shared/attribution.ts), or "". The
 * server renders the links without it and the browser adds it on hydration, so the two agree.
 */
export function useAttributionQuery(): string {
  return useSyncExternalStore(noChanges, fromThisVisit, onTheServer);
}
