import { and, count, eq, gte, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { aiCalls } from '@/lib/db/schema';

/*
 * A cap on AI model calls per person, counted per call rather than per receipt created, so
 * re-reading, retrying a failed bill, parallel requests and the spending summary all count.
 * The creation limits (lib/receipt-rate-limit.ts, lib/bill-rate-limit.ts) stay in front of it;
 * this is what stops a script spending the gateway credits through the paths they don't see.
 *
 * Insert, then count: every request sees its own row, so parallel requests can't all slip in under
 * the limit, as count-then-insert allowed. A refused call's row is removed again.
 *
 * The limits are several times what a busy household does in a day (a Flash-Lite read costs about
 * $0.0005, so even the cap is pennies; the point is that nothing is unlimited).
 */
export const AI_CALLS_PER_HOUR = 60;
export const AI_CALLS_PER_DAY = 200;

export type AiCallKind = 'receipt' | 'bill' | 'summary';
export type AiBudgetResult = { ok: true } | { ok: false; message: string; retryAfterSeconds: number };

/** Pure: whether a count, including this call, is within the limits. */
export function judgeAiBudget(lastHour: number, lastDay: number): AiBudgetResult {
  if (lastDay > AI_CALLS_PER_DAY) {
    return {
      ok: false,
      message: `That's the daily limit of ${AI_CALLS_PER_DAY} reads in 24 hours. Try again tomorrow, or email support@receiptwise.io if you need more.`,
      retryAfterSeconds: 60 * 60,
    };
  }
  if (lastHour > AI_CALLS_PER_HOUR) {
    return { ok: false, message: 'That\'s a lot of reading in the last hour. Give it a little while and try again.', retryAfterSeconds: 15 * 60 };
  }
  return { ok: true };
}

/** Records one model call for this person, or refuses it if they're over the limit. */
export async function reserveAiCall(userId: string, kind: AiCallKind): Promise<AiBudgetResult> {
  const now = Date.now();
  const [row] = await db.insert(aiCalls).values({ userId, kind }).returning({ id: aiCalls.id });
  const counted = async (since: number) => {
    const [result] = await db
      .select({ n: count() })
      .from(aiCalls)
      .where(and(eq(aiCalls.userId, userId), gte(aiCalls.createdAt, new Date(since))));
    return result.n;
  };
  const verdict = judgeAiBudget(await counted(now - 60 * 60 * 1000), await counted(now - 24 * 60 * 60 * 1000));
  if (!verdict.ok) await db.delete(aiCalls).where(eq(aiCalls.id, row.id));
  return verdict;
}

/** Drops rows the limits no longer look at (hourly, from the sweep). */
export async function pruneAiCalls(): Promise<number> {
  const deleted = await db
    .delete(aiCalls)
    .where(lt(aiCalls.createdAt, new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)))
    .returning({ id: aiCalls.id });
  return deleted.length;
}
