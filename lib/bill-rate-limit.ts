import { and, count, eq, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { billDocuments } from '@/lib/db/schema';
import { type RateLimitResult } from '@/lib/receipt-rate-limit';

/*
 * Per-user cap on new bill documents, uploaded or forwarded. Each one costs a gpt-4o call. Counted
 * off bill_documents.created_at like the receipt limit; deleted documents still count. Far above
 * what anyone's own bills come to.
 */
const HOURLY_LIMIT = 20;
const DAILY_LIMIT = 60;

export async function checkBillDocumentLimit(userId: string, adding = 1): Promise<RateLimitResult> {
  const now = Date.now();
  const [{ lastDay }] = await db
    .select({ lastDay: count() })
    .from(billDocuments)
    .where(and(eq(billDocuments.userId, userId), gte(billDocuments.createdAt, new Date(now - 24 * 60 * 60 * 1000))));
  if (lastDay + adding > DAILY_LIMIT) {
    return {
      limited: true,
      message: `You've added ${DAILY_LIMIT} bills in the last 24 hours, which is the daily limit. Try again tomorrow.`,
      retryAfterSeconds: 60 * 60,
    };
  }

  const [{ lastHour }] = await db
    .select({ lastHour: count() })
    .from(billDocuments)
    .where(and(eq(billDocuments.userId, userId), gte(billDocuments.createdAt, new Date(now - 60 * 60 * 1000))));
  if (lastHour + adding > HOURLY_LIMIT) {
    return {
      limited: true,
      message: `You've added ${HOURLY_LIMIT} bills in the last hour. Give it a little while and try again.`,
      retryAfterSeconds: 15 * 60,
    };
  }
  return { limited: false };
}
