import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { and, eq, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import { del } from '@vercel/blob';
import { receiptsBlobToken } from '@/lib/storage/receipt-blob';
import { db } from '@/lib/db';
import { billDocuments, inboundEmails, receipts } from '@/lib/db/schema';
import { processInboundEmail } from '@/lib/inbound-email/ingest';
import { processBillDocument } from '@/lib/services/bill-document-service';
import { deletePrivate, isPrivateStoreConfigured } from '@/lib/storage/private-blob';
import { isCronAuthorized } from '@/lib/cron-auth';
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
/** Bill documents left unread this long (their waitUntil died) are read again here, a few per run. */
const BILL_REREAD_AFTER_MS = 10 * 60 * 1000;
const MAX_BILL_REREADS_PER_RUN = 10;
/** Forwarded emails: the raw message is kept this long after processing, the record this long in all. */
const RAW_EMAIL_KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_RECORD_KEEP_MS = 90 * 24 * 60 * 60 * 1000;

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

  if (!isCronAuthorized(req)) {
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
        await del(blobUrls.slice(i, i + 1000), { token: receiptsBlobToken() });
      }

      // receipt_items cascade; subscription_payments.receipt_id is set null.
      const deleted = await db
        .delete(receipts)
        .where(inArray(receipts.id, toPurge.map((r) => r.id)))
        .returning({ id: receipts.id });
      purged = deleted.length;
    }

    // Bills: read again any that were never read (processBillDocument gives up after its attempts),
    // and purge deleted ones, file included, after the same 30 days as receipts.
    const unread = await db
      .select({ id: billDocuments.id })
      .from(billDocuments)
      .where(and(
        isNull(billDocuments.deletedAt),
        inArray(billDocuments.processingStatus, ['pending', 'processing']),
        lt(billDocuments.updatedAt, new Date(now - BILL_REREAD_AFTER_MS)),
      ))
      .limit(MAX_BILL_REREADS_PER_RUN);
    let billsReread = 0;
    for (const { id } of unread) {
      if (await processBillDocument(id, correlationId)) billsReread++;
    }

    let billsPurged = 0;
    if (isPrivateStoreConfigured()) {
      const billsToPurge = await db
        .select({ id: billDocuments.id, blobPathname: billDocuments.blobPathname })
        .from(billDocuments)
        .where(and(isNotNull(billDocuments.deletedAt), lt(billDocuments.deletedAt, new Date(now - PURGE_AFTER_MS))))
        .limit(MAX_PURGE_PER_RUN);
      if (billsToPurge.length > 0) {
        await deletePrivate(billsToPurge.map((row) => row.blobPathname));
        const deleted = await db
          .delete(billDocuments)
          .where(inArray(billDocuments.id, billsToPurge.map((row) => row.id)))
          .returning({ id: billDocuments.id });
        billsPurged = deleted.length;
      }
    }

    // Forwarded emails: read any the Worker handed over that were never read; delete raw messages a
    // week after processing, and the records after 90 days.
    let emailsReread = 0;
    let rawEmailsPurged = 0;
    let emailRecordsPurged = 0;
    if (isPrivateStoreConfigured()) {
      const unreadEmails = await db
        .select({ id: inboundEmails.id })
        .from(inboundEmails)
        .where(and(eq(inboundEmails.status, 'stored'), lt(inboundEmails.updatedAt, new Date(now - BILL_REREAD_AFTER_MS))))
        .limit(MAX_BILL_REREADS_PER_RUN);
      for (const { id } of unreadEmails) {
        await processInboundEmail(id, correlationId);
        emailsReread++;
      }

      const rawToPurge = await db
        .select({ id: inboundEmails.id, rawBlobPathname: inboundEmails.rawBlobPathname })
        .from(inboundEmails)
        .where(and(isNotNull(inboundEmails.rawBlobPathname), isNotNull(inboundEmails.processedAt), lt(inboundEmails.processedAt, new Date(now - RAW_EMAIL_KEEP_MS))))
        .limit(MAX_PURGE_PER_RUN);
      if (rawToPurge.length > 0) {
        await deletePrivate(rawToPurge.map((row) => row.rawBlobPathname!));
        await db.update(inboundEmails).set({ rawBlobPathname: null, updatedAt: new Date() }).where(inArray(inboundEmails.id, rawToPurge.map((row) => row.id)));
        rawEmailsPurged = rawToPurge.length;
      }

      const oldRecords = await db
        .delete(inboundEmails)
        .where(and(isNull(inboundEmails.rawBlobPathname), lt(inboundEmails.receivedAt, new Date(now - EMAIL_RECORD_KEEP_MS))))
        .returning({ id: inboundEmails.id });
      emailRecordsPurged = oldRecords.length;
    }

    const summary = {
      stuckProcessing: stuckProcessing.length,
      stuckPending: stuckPending.length,
      purged,
      billsReread,
      billsPurged,
      emailsReread,
      rawEmailsPurged,
      emailRecordsPurged,
    };

    if (Object.values(summary).some((value) => value > 0)) {
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
