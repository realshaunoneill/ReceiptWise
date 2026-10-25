import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { billDocuments, receipts, type BillDocument, type Receipt } from '@/lib/db/schema';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { processBillDocument } from '@/lib/services/bill-document-service';
import { billsPrefix, putPrivate } from '@/lib/storage/private-blob';
import { invalidateInsightsCache } from '@/lib/utils/cache-helpers';

/**
 * A bill that came in as a receipt: copy its image into the private bills store, file it as a bill
 * document, and soft-delete the receipt so its amount stops counting as spending. The receipt and
 * its public image are purged after 30 days as usual.
 *
 * Used by "Move to Bills" on a receipt, and automatically for a Chrome extension clip that the
 * reader says is a bill. Callers check access, the bills feature, the private store and the bill
 * rate limit first. Returns the document, which the caller hands to processBillDocument.
 */

const IMAGE_FETCH_TIMEOUT_MS = 15_000;
export const BILL_IMAGE_EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export class MoveToBillsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'MoveToBillsError';
  }
}

export async function moveReceiptToBills(receipt: Receipt, correlationId: CorrelationId): Promise<BillDocument> {
  const image = await fetch(receipt.imageUrl, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) });
  if (!image.ok) throw new MoveToBillsError("The receipt image couldn't be loaded", 502);
  const mimeType = (image.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  const extension = BILL_IMAGE_EXTENSIONS[mimeType];
  if (!extension) throw new MoveToBillsError('Only images can be moved', 400);
  const bytes = Buffer.from(await image.arrayBuffer());

  const pathname = `${billsPrefix(receipt.userId)}receipt-${receipt.id}-${randomBytes(8).toString('hex')}.${extension}`;
  await putPrivate(pathname, bytes, mimeType);

  const document = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(billDocuments)
      .values({
        userId: receipt.userId,
        householdId: receipt.householdId,
        source: 'receipt_move',
        blobPathname: pathname,
        mimeType,
        fileName: receipt.merchantName ? `${receipt.merchantName}.${extension}` : null,
        sizeBytes: bytes.length,
        receiptId: receipt.id,
      })
      .returning();
    await tx.update(receipts).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(receipts.id, receipt.id));
    return created;
  });

  await invalidateInsightsCache(receipt.userId, receipt.householdId ?? undefined, correlationId);
  submitLogEvent('bill-document', 'Receipt moved to bills', correlationId, { documentId: document.id, receiptId: receipt.id });
  return document;
}

/** Move it, then read it as a bill. The bill's own processing records any failure on the document. */
export async function moveReceiptToBillsAndRead(receipt: Receipt, correlationId: CorrelationId): Promise<BillDocument> {
  const document = await moveReceiptToBills(receipt, correlationId);
  await processBillDocument(document.id, correlationId);
  return document;
}
