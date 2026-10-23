import { randomBytes } from 'crypto';
import { waitUntil } from '@vercel/functions';
import { type NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { billDocuments, receipts } from '@/lib/db/schema';
import { checkBillDocumentLimit } from '@/lib/bill-rate-limit';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { processBillDocument, toClientDocument } from '@/lib/services/bill-document-service';
import { billsPrefix, isPrivateStoreConfigured, putPrivate } from '@/lib/storage/private-blob';
import { invalidateInsightsCache } from '@/lib/utils/cache-helpers';

export const runtime = 'nodejs';
export const maxDuration = 90;

const IMAGE_FETCH_TIMEOUT_MS = 15_000;
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/receipts/[id]/move-to-bills - A bill uploaded as a receipt: copy its image into the
// private bills store, read it as a bill, and delete the receipt (so its amount stops counting as
// spending). Owner only.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: true, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId } = guard;
  const { id } = await params;

  if (!isPrivateStoreConfigured()) return NextResponse.json({ error: 'Bills are not set up yet' }, { status: 503 });

  try {
    const [receipt] = await db
      .select()
      .from(receipts)
      .where(and(eq(receipts.id, id), eq(receipts.userId, user.id), isNull(receipts.deletedAt)))
      .limit(1);
    if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });

    const limit = await checkBillDocumentLimit(user.id);
    if (limit.limited) return NextResponse.json({ error: limit.message }, { status: 429 });

    const image = await fetch(receipt.imageUrl, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) });
    if (!image.ok) return NextResponse.json({ error: "The receipt image couldn't be loaded" }, { status: 502 });
    const mimeType = (image.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    if (!EXTENSIONS[mimeType]) return NextResponse.json({ error: 'Only images can be moved' }, { status: 400 });
    const bytes = Buffer.from(await image.arrayBuffer());

    const pathname = `${billsPrefix(user.id)}receipt-${receipt.id}-${randomBytes(8).toString('hex')}.${EXTENSIONS[mimeType]}`;
    await putPrivate(pathname, bytes, mimeType);

    const document = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(billDocuments)
        .values({
          userId: user.id,
          householdId: receipt.householdId,
          source: 'receipt_move',
          blobPathname: pathname,
          mimeType,
          fileName: receipt.merchantName ? `${receipt.merchantName}.${EXTENSIONS[mimeType]}` : null,
          sizeBytes: bytes.length,
          receiptId: receipt.id,
        })
        .returning();
      // Soft delete: the receipt and its public image are purged after 30 days as usual.
      await tx.update(receipts).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(receipts.id, receipt.id));
      return created;
    });

    await invalidateInsightsCache(user.id, receipt.householdId ?? undefined, correlationId);
    waitUntil(processBillDocument(document.id, correlationId));

    submitLogEvent('bill-document', 'Receipt moved to bills', correlationId, { documentId: document.id, receiptId: receipt.id });
    return NextResponse.json(toClientDocument(document), { status: 201, headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('bill-document', `Error moving receipt to bills: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { receiptId: id }, true);
    return NextResponse.json({ error: 'Failed to move it to bills' }, { status: 500 });
  }
}
