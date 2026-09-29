import { and, count, eq, gte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { receipts } from '@/lib/db/schema';

/*
 * Per-user cap on new receipts, across the web uploader and the extension.
 *
 * Every receipt costs a GPT-4o vision call, and at €1.99/month one scripted account could
 * otherwise spend many times its subscription in an afternoon. Counted off receipts.created_at
 * (indexed via user_id) rather than a separate counter, so there is nothing extra to keep in sync;
 * soft-deleted receipts still count, which is the point — delete-and-reupload is not a way round it.
 *
 * The limits are far above what a person photographing their own receipts does in a day.
 */
const HOURLY_LIMIT = 30;
const DAILY_LIMIT = 150;

export type RateLimitResult = { limited: false } | { limited: true; message: string; retryAfterSeconds: number };

export async function checkReceiptCreationLimit(userId: string): Promise<RateLimitResult> {
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000);
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);

  const [{ lastDay }] = await db
    .select({ lastDay: count() })
    .from(receipts)
    .where(and(eq(receipts.userId, userId), gte(receipts.createdAt, dayAgo)));

  if (lastDay >= DAILY_LIMIT) {
    return {
      limited: true,
      message: `You've added ${DAILY_LIMIT} receipts in the last 24 hours, which is the daily limit. Try again tomorrow, or email support@receiptwise.io if you need more.`,
      retryAfterSeconds: 60 * 60,
    };
  }

  const [{ lastHour }] = await db
    .select({ lastHour: count() })
    .from(receipts)
    .where(and(eq(receipts.userId, userId), gte(receipts.createdAt, hourAgo)));

  if (lastHour >= HOURLY_LIMIT) {
    return {
      limited: true,
      message: `You've added ${HOURLY_LIMIT} receipts in the last hour. Give it a little while and try again.`,
      retryAfterSeconds: 15 * 60,
    };
  }

  return { limited: false };
}
