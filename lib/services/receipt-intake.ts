import { put } from '@vercel/blob';
import { waitUntil } from '@vercel/functions';
import { and, eq } from 'drizzle-orm';
import { getHouseholdMembership } from '@/lib/auth-helpers';
import { checkBillDocumentLimit } from '@/lib/bill-rate-limit';
import { db } from '@/lib/db';
import { receipts, type Receipt, type User } from '@/lib/db/schema';
import { isFeatureEnabled } from '@/lib/features';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import * as push from '@/lib/push/events';
import { processReceipt } from '@/lib/receipt-processing';
import { moveReceiptToBillsAndRead } from '@/lib/services/receipt-to-bill';
import { isPrivateStoreConfigured } from '@/lib/storage/private-blob';
import { receiptsBlobToken } from '@/lib/storage/receipt-blob';

/**
 * A receipt image sent in one request (the Chrome extension, the app): stored, filed and read on
 * the server. Reading happens after the response, in waitUntil, so it finishes even if the phone
 * that sent it goes to sleep. Callers check who is sending it and the upload rate limit first.
 */

const ENV_PATH_PREFIX = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
export const MAX_RECEIPT_UPLOAD_MB = 15;
export const RECEIPT_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export class IntakeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'IntakeError';
  }
}

export type IntakeOptions = {
  user: User;
  file: File;
  source: 'app' | 'extension';
  /**
   * A household to file it in, null for personal, or undefined for the user's default household
   * (if they are still in it). A household the user isn't in is refused.
   */
  householdId?: string | null;
  /** The sender's id for this capture: the same id again returns the first receipt. */
  clientUploadId?: string | null;
  /** Move it to the bill inbox if the reader says it's a bill (and the account has bills). */
  fileBills: boolean;
  correlationId: CorrelationId;
};

export async function intakeReceiptFile(options: IntakeOptions): Promise<{ receipt: Receipt; created: boolean }> {
  const { user, file, source, clientUploadId, correlationId } = options;

  const extension = RECEIPT_IMAGE_TYPES[file.type];
  if (!extension) throw new IntakeError('Invalid file type. Allowed: JPEG, PNG, WebP', 400);
  if (file.size > MAX_RECEIPT_UPLOAD_MB * 1024 * 1024) throw new IntakeError(`File too large. Max size: ${MAX_RECEIPT_UPLOAD_MB}MB`, 413);

  if (clientUploadId) {
    const existing = await findByClientUploadId(user.id, clientUploadId);
    if (existing) return { receipt: existing, created: false };
  }

  const householdId = await resolveHousehold(user, options.householdId);

  // Random suffix so blob URLs are not guessable from the user id and a timestamp.
  const blob = await put(`${ENV_PATH_PREFIX}/receipts/${user.id}/${source}.${extension}`, file, {
    access: 'public',
    contentType: file.type,
    addRandomSuffix: true,
    token: receiptsBlobToken(),
  });

  const [inserted] = await db
    .insert(receipts)
    .values({ userId: user.id, householdId, imageUrl: blob.url, processingStatus: 'pending', source, clientUploadId: clientUploadId ?? null })
    // Two copies of the same capture at once: the other one made the row.
    .onConflictDoNothing({ target: [receipts.userId, receipts.clientUploadId] })
    .returning();
  if (!inserted) {
    const existing = clientUploadId ? await findByClientUploadId(user.id, clientUploadId) : null;
    if (existing) return { receipt: existing, created: false };
    throw new Error('Receipt was not created');
  }

  submitLogEvent(`${source}-upload`, 'Receipt created', correlationId, { receiptId: inserted.id, userId: user.id, householdId, fileSize: file.size });

  // processReceipt records 'failed' itself on error, and the hourly sweeper catches anything the
  // function was stopped before finishing.
  waitUntil(
    processReceipt(inserted.id, user.id, correlationId)
      .then(async (result) => {
        const filedAsBill = result.ok && options.fileBills ? await fileBillsAsBills(result.receipt, result.ocrData.documentKind, user, source, correlationId) : false;
        // A bill filed from here is told about by its own processing (lib/push/events.ts).
        if (filedAsBill) return;
        if (result.ok) push.receiptProcessed(result.receipt, { ok: true, itemCount: result.items.length }, source, correlationId);
        else if (result.reason === 'failed') push.receiptProcessed(inserted, { ok: false }, source, correlationId);
      })
      .catch((error) => {
        submitLogEvent(`${source}-upload`, `Background processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { receiptId: inserted.id }, true);
      }),
  );

  return { receipt: inserted, created: true };
}

/** The receipt an earlier send of this capture made, if any. */
export async function findByClientUploadId(userId: string, clientUploadId: string): Promise<Receipt | null> {
  const [receipt] = await db
    .select()
    .from(receipts)
    .where(and(eq(receipts.userId, userId), eq(receipts.clientUploadId, clientUploadId)))
    .limit(1);
  return receipt ?? null;
}

async function resolveHousehold(user: User, requested: string | null | undefined): Promise<string | null> {
  if (requested === null) return null;
  if (requested !== undefined) {
    const membership = await getHouseholdMembership(requested, user.id);
    if (!membership) throw new IntakeError('You are not a member of that household', 403);
    return requested;
  }
  // The default household only while the user is still in it: leaving one didn't clear it, so
  // captures kept appearing in an ex-household.
  if (!user.defaultHouseholdId) return null;
  const membership = await getHouseholdMembership(user.defaultHouseholdId, user.id);
  return membership ? user.defaultHouseholdId : null;
}

/**
 * A capture the reader says is a bill (an energy bill, a card statement) goes to the bill inbox,
 * as forwarded email does, instead of sitting in Receipts until someone presses "Move to Bills".
 * Only where the account has bills and the private store is set up, and within the bill rate
 * limit; otherwise it stays a receipt, with the button.
 */
async function fileBillsAsBills(
  receipt: Receipt,
  documentKind: string | null | undefined,
  user: User,
  source: IntakeOptions['source'],
  correlationId: CorrelationId,
): Promise<boolean> {
  if (documentKind !== 'bill' || !isFeatureEnabled(user, 'bills') || !isPrivateStoreConfigured()) return false;
  const limit = await checkBillDocumentLimit(user.id);
  if (limit.limited) return false;
  await moveReceiptToBillsAndRead(receipt, correlationId);
  submitLogEvent(`${source}-upload`, 'Captured bill filed in the bill inbox', correlationId, { receiptId: receipt.id });
  return true;
}
