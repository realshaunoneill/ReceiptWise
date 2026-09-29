import { eq } from 'drizzle-orm';
import { receipts } from '@/lib/db/schema';

/*
 * Shared query-param handling for the insights routes (/api/receipts/items/*).
 *
 * `months` went straight from the query string into the date maths and the cache key, so
 * `?months=abc` made toISOString() throw (a 500), and every distinct value was a new cache key —
 * looping ?months=1..N bypassed the cache and ran a fresh AI summary each time.
 */

const ALLOWED_MONTHS = [1, 3, 6, 12] as const;

export function parseMonths(raw: string | null, fallback: (typeof ALLOWED_MONTHS)[number]): number {
  const parsed = parseInt(raw || '', 10);
  return (ALLOWED_MONTHS as readonly number[]).includes(parsed) ? parsed : fallback;
}

export function parseBoundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = parseInt(raw || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/** First day of the window, as 'YYYY-MM-DD' (the format transactionDate is stored in). */
export function windowStart(months: number): string {
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  return start.toISOString().split('T')[0];
}

/**
 * Which receipts an insights query covers.
 *
 * With a household (membership already checked by the caller): every member's receipts in it.
 * These routes used to AND `receipts.userId = me` onto the household filter, so a household's
 * "shared" spending summary, top items and item history only ever counted the caller's own
 * purchases. Without a household: the caller's own receipts.
 */
export function receiptScope(userId: string, householdId: string | null) {
  return householdId ? eq(receipts.householdId, householdId) : eq(receipts.userId, userId);
}
