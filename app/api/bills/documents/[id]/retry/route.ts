import { type NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { billDocuments } from '@/lib/db/schema';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { getBillDocument, processBillDocument, toClientDocument } from '@/lib/services/bill-document-service';
import { canOwnFinanceRow } from '@/lib/services/finance-access';

export const runtime = 'nodejs';
export const maxDuration = 90;

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/bills/documents/[id]/retry - Read a failed document again (its owner only)
export async function POST(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: true, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { id } = await params;

  const document = await getBillDocument(id);
  if (!document || !canOwnFinanceRow(document, user.id, entitlements)) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  if (document.processingStatus !== 'failed') return NextResponse.json({ error: 'This bill has already been read' }, { status: 409 });

  // An explicit retry gets a fresh set of attempts.
  await db.update(billDocuments).set({ processingAttempts: 0, updatedAt: new Date() }).where(eq(billDocuments.id, id));
  const processed = await processBillDocument(id, correlationId);
  if (!processed) return NextResponse.json({ error: 'It is already being read' }, { status: 409 });
  return NextResponse.json(toClientDocument(processed), { headers: PRIVATE_NO_STORE });
}
