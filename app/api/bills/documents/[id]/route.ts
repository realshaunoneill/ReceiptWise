import { type NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { billDocuments } from '@/lib/db/schema';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { getBillDocument, matchSuggestions, toClientDocument } from '@/lib/services/bill-document-service';
import { canOwnFinanceRow, canReadFinanceRow } from '@/lib/services/finance-access';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

const NOT_FOUND = { error: 'Bill not found' };

// GET /api/bills/documents/[id] - One document, with where it could be filed
export async function GET(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: false, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, entitlements } = guard;
  const { id } = await params;

  const document = await getBillDocument(id);
  if (!document || !canReadFinanceRow(document, user.id, entitlements)) return NextResponse.json(NOT_FOUND, { status: 404 });
  return NextResponse.json(
    { ...toClientDocument(document), suggestions: document.processingStatus === 'completed' ? await matchSuggestions(document) : [] },
    { headers: PRIVATE_NO_STORE },
  );
}

// DELETE /api/bills/documents/[id] - Remove a document (its owner only). The file is purged by the
// hourly sweep 30 days later, with the row; whatever it was filed as stays in the plan.
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: false, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { id } = await params;

  const document = await getBillDocument(id);
  if (!document || !canReadFinanceRow(document, user.id, entitlements)) return NextResponse.json(NOT_FOUND, { status: 404 });
  if (!canOwnFinanceRow(document, user.id, entitlements)) {
    return NextResponse.json({ error: 'Only the person who added this can remove it' }, { status: 403 });
  }

  await db.update(billDocuments).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(billDocuments.id, id));
  submitLogEvent('bill-document', 'Bill removed', correlationId, { documentId: id });
  return NextResponse.json({ success: true });
}
