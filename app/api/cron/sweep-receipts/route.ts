import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID, timingSafeEqual } from 'crypto';
import { and, eq, inArray, isNotNull, lt } from 'drizzle-orm';
import { del } from '@vercel/blob';
import { db } from '@/lib/db';
import { receipts } from '@/lib/db/schema';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** A 'processing' row this old was abandoned: its function was killed or timed out. */
const STUCK_PROCESSING_MS = 15 * 60 * 1000;
/** A 'pending' row this old never had processing started (tab closed mid-upload, trigger lost). */
const STUCK_PENDING_MS = 30 * 60 * 1000;
/** Soft-deleted receipts are purged for good, image included, after this long. */
const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
/** Bounded per run so the job stays well inside maxDuration; the rest go next hour. */
const MAX_PURGE_PER_RUN = 200;

const STUCK_MESSAGE = "Reading this receipt didn't finish. Try again.";

/**
 * Constant-time comparison of the cron bearer token. Fails closed when CRON_SECRET is
 * unset so a misconfigured deploy can't expose an unauthenticated destructive endpoint.
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const provided = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.public.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

/**
 * GET /api/cron/sweep-receipts (hourly)
 *
 * 1. Stuck rows → 'failed'. Nothing else ever moved a receipt out of 'pending' or 'processing'
 *    if the function doing the work died, so it sat there forever with no Retry button. Marking
 *    it failed puts the Retry button back in front of the user.
 * 2. Purge. Deleting a receipt only soft-deletes it; the row, its line items and its public image
 *    used to stay forever. They are now removed 30 days after deletion, as the privacy policy says.
 */
export async function GET(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  if (!isAuthorized(req)) {
    submitLogEvent('receipt', 'Unauthorized call to sweep-receipts cron', correlationId, {}, true);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = Date.now();

    const stuckProcessing = await db
      .update(receipts)
      .set({ processingStatus: 'failed', processingError: STUCK_MESSAGE, updatedAt: new Date() })
      .where(
        and(
          eq(receipts.processingStatus, 'processing'),
          lt(receipts.updatedAt, new Date(now - STUCK_PROCESSING_MS)),
        ),
      )
      .returning({ id: receipts.id });

    const stuckPending = await db
      .update(receipts)
      .set({ processingStatus: 'failed', processingError: STUCK_MESSAGE, updatedAt: new Date() })
      .where(
        and(
          eq(receipts.processingStatus, 'pending'),
          lt(receipts.updatedAt, new Date(now - STUCK_PENDING_MS)),
        ),
      )
      .returning({ id: receipts.id });

    const toPurge = await db
      .select({ id: receipts.id, imageUrl: receipts.imageUrl })
      .from(receipts)
      .where(and(isNotNull(receipts.deletedAt), lt(receipts.deletedAt, new Date(now - PURGE_AFTER_MS))))
      .limit(MAX_PURGE_PER_RUN);

    let purged = 0;
    if (toPurge.length > 0) {
      // Images first: if the blob delete fails, the rows stay and are retried next run rather
      // than leaving an image nothing points at any more.
      const blobUrls = toPurge.map((r) => r.imageUrl).filter(isBlobUrl);
      for (let i = 0; i < blobUrls.length; i += 1000) {
        await del(blobUrls.slice(i, i + 1000));
      }

      // receipt_items cascade; subscription_payments.receipt_id is set null.
      const deleted = await db
        .delete(receipts)
        .where(inArray(receipts.id, toPurge.map((r) => r.id)))
        .returning({ id: receipts.id });
      purged = deleted.length;
    }

    const summary = {
      stuckProcessing: stuckProcessing.length,
      stuckPending: stuckPending.length,
      purged,
    };

    if (summary.stuckProcessing || summary.stuckPending || summary.purged) {
      submitLogEvent('receipt', 'sweep-receipts cron run', correlationId, summary);
    }

    return NextResponse.json(summary);
  } catch (error) {
    submitLogEvent(
      'receipt',
      `sweep-receipts cron failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      correlationId,
      { error: error instanceof Error ? error.stack : undefined },
      true,
    );
    return NextResponse.json({ error: 'Cron run failed' }, { status: 500 });
  }
}
