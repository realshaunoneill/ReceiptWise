import { waitUntil } from '@vercel/functions';
import { type NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { receipts } from '@/lib/db/schema';
import { checkBillDocumentLimit } from '@/lib/bill-rate-limit';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { processBillDocument, toClientDocument } from '@/lib/services/bill-document-service';
import { moveReceiptToBills, MoveToBillsError } from '@/lib/services/receipt-to-bill';
import { isPrivateStoreConfigured } from '@/lib/storage/private-blob';

export const runtime = 'nodejs';
export const maxDuration = 90;

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

    const document = await moveReceiptToBills(receipt, correlationId);
    waitUntil(processBillDocument(document.id, correlationId));
    return NextResponse.json(toClientDocument(document), { status: 201, headers: PRIVATE_NO_STORE });
  } catch (error) {
    if (error instanceof MoveToBillsError) return NextResponse.json({ error: error.message }, { status: error.status });
    submitLogEvent('bill-document', `Error moving receipt to bills: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { receiptId: id }, true);
    return NextResponse.json({ error: 'Failed to move it to bills' }, { status: 500 });
  }
}
