/**
 * The captures waiting to go up, as a pure state machine; src/upload/runner.ts stores it on the
 * phone and does the uploading. A capture is never lost to a dropped connection: it waits, retries
 * with backoff, and each try carries the same id, so the server makes one receipt or bill however
 * many tries it takes (POST /api/receipts/capture or /api/bills/documents/capture, Idempotency-Key).
 */

import { LEGACY_SLOT } from '../auth/account-list';

export type QueueStatus = 'waiting' | 'uploading' | 'done' | 'failed';

/** One file on the phone: the app's own copy, compressed if it's a photo. */
export type QueueFile = { uri: string; mimeType: string; name: string };

export type QueueItem = {
  /** Also the Idempotency-Key. */
  id: string;
  /** A receipt (one photo), or a bill: one PDF, or the pages of a scan, which become one PDF. */
  target: 'receipt' | 'bill';
  files: QueueFile[];
  /** Receipts only: 'auto' lets the server move a bill to the bill inbox. */
  kind: 'receipt' | 'auto';
  /** A household, null for personal, undefined for the default household. */
  householdId?: string | null;
  /**
   * Whose capture it is (an account's slot, src/auth/accounts.ts): it uploads to that account even
   * if someone else is on screen by then. Missing from before there were several: the first account.
   */
  account?: string;
  createdAt: number;
  status: QueueStatus;
  attempts: number;
  /** Not before this (backoff, or the server's Retry-After). */
  notBefore: number;
  error?: string;
  /** The receipt or bill document it made. */
  resultId?: string;
};

export type QueueEvent =
  | { type: 'add'; item: QueueItem }
  | { type: 'start'; id: string }
  | { type: 'uploaded'; id: string; resultId: string }
  /** Worth trying again: offline, a server error, a rate limit. */
  | { type: 'retryable'; id: string; now: number; error: string; retryAfterMs?: number }
  /** Not worth trying again as it is: rejected by the server, or out of tries. */
  | { type: 'failed'; id: string; error: string }
  /** The person pressed Retry. */
  | { type: 'retry'; id: string }
  | { type: 'remove'; id: string }
  /** After a restart: anything mid-upload when the app stopped goes back to waiting. */
  | { type: 'restore' };

export const MAX_ATTEMPTS = 8;

/** 30 s, 1 min, 2 min… up to 15 minutes between tries. */
export function backoffMs(attempts: number): number {
  return Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 15 * 60_000);
}

export function reduce(items: QueueItem[], event: QueueEvent): QueueItem[] {
  const update = (id: string, change: (item: QueueItem) => QueueItem) => items.map((item) => (item.id === id ? change(item) : item));
  switch (event.type) {
    case 'add':
      return items.some((item) => item.id === event.item.id) ? items : [...items, event.item];
    case 'start':
      return update(event.id, (item) => ({ ...item, status: 'uploading', attempts: item.attempts + 1, error: undefined }));
    case 'uploaded':
      return update(event.id, (item) => ({ ...item, status: 'done', resultId: event.resultId, error: undefined }));
    case 'retryable':
      return update(event.id, (item) =>
        item.attempts >= MAX_ATTEMPTS
          ? { ...item, status: 'failed', error: event.error }
          : { ...item, status: 'waiting', error: event.error, notBefore: event.now + (event.retryAfterMs ?? backoffMs(item.attempts)) });
    case 'failed':
      return update(event.id, (item) => ({ ...item, status: 'failed', error: event.error }));
    case 'retry':
      return update(event.id, (item) => ({ ...item, status: 'waiting', attempts: 0, notBefore: 0, error: undefined }));
    case 'remove':
      return items.filter((item) => item.id !== event.id);
    case 'restore':
      return items.map((item) => (item.status === 'uploading' ? { ...item, status: 'waiting' } : item));
  }
}

/** The next capture to send: one at a time, oldest first, once its wait is over. */
export function nextToUpload(items: QueueItem[], now: number): QueueItem | undefined {
  if (items.some((item) => item.status === 'uploading')) return undefined;
  return items.filter((item) => item.status === 'waiting' && item.notBefore <= now).sort((a, b) => a.createdAt - b.createdAt)[0];
}

/** When the next waiting capture may go, for a timer; null if none is waiting. */
export function nextWakeAt(items: QueueItem[]): number | null {
  const waiting = items.filter((item) => item.status === 'waiting').map((item) => item.notBefore);
  return waiting.length ? Math.min(...waiting) : null;
}

/** One account's captures, for what's shown: the queue holds every account's. */
export function itemsFor(items: QueueItem[], account: string | null): QueueItem[] {
  return items.filter((item) => (item.account ?? LEGACY_SLOT) === account);
}

/** "1 receipt", "3 bills", or "2 uploads" for a mix. */
function count(items: QueueItem[]): string {
  const noun = items.every((item) => item.target === 'receipt') ? 'receipt' : items.every((item) => item.target === 'bill') ? 'bill' : 'upload';
  return items.length === 1 ? `1 ${noun}` : `${items.length} ${noun}s`;
}

/** Shown under the capture button: "Uploading 2 of 5", "Waiting for a connection", "1 didn't upload". */
export function queueSummary(items: QueueItem[], online: boolean): string | null {
  const pending = items.filter((item) => item.status === 'waiting' || item.status === 'uploading');
  const failed = items.filter((item) => item.status === 'failed');
  if (pending.length > 0) {
    if (!online) return `${count(pending)} waiting for a connection`;
    const batch = items.filter((item) => item.status !== 'failed');
    if (batch.length === 1) return `Uploading ${count(batch)}`;
    const position = batch.length - pending.length + 1;
    return `Uploading ${position} of ${batch.length}`;
  }
  if (failed.length > 0) return `${count(failed)} didn't upload`;
  return null;
}
