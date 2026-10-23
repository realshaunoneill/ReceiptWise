import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { applyBillDocument, BillApplyError, getBillDocument, toClientDocument } from '@/lib/services/bill-document-service';
import { canReadFinanceRow } from '@/lib/services/finance-access';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { BILLING_FREQUENCIES } from '@/lib/schedule/billing-schedule';
import { parseBody, readJson } from '@/lib/validation/finance';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

const applySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('match'), subscriptionId: z.string().uuid(), amount: z.enum(['due', 'minimum']).optional() }).strict(),
  z.object({ action: z.literal('new_bill'), name: z.string().trim().max(200).optional(), billingFrequency: z.enum(BILLING_FREQUENCIES).optional() }).strict(),
  z.object({ action: z.literal('one_off'), label: z.string().trim().max(120).optional() }).strict(),
  z.object({ action: z.literal('dismiss') }).strict(),
]);

// POST /api/bills/documents/[id]/apply - File a document: against an existing bill (that cycle's
// amount and due date), as a new recurring bill, as a one-off in the plan, or dismiss it. Anyone
// who can see the document can, as with marking a shared bill paid.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: true, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { id } = await params;

  try {
    const document = await getBillDocument(id);
    if (!document || !canReadFinanceRow(document, user.id, entitlements)) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    if (document.processingStatus !== 'completed') return NextResponse.json({ error: 'This bill hasn\'t been read yet' }, { status: 409 });

    const parsed = parseBody(applySchema, await readJson(req));
    if (parsed instanceof NextResponse) return parsed;
    const action = parsed.data;

    if (action.action === 'match') {
      const subscription = await SubscriptionService.getById(action.subscriptionId);
      if (!subscription || !canReadFinanceRow(subscription, user.id, entitlements)) {
        return NextResponse.json({ error: 'That bill no longer exists' }, { status: 404 });
      }
    }

    const applied = await applyBillDocument(document, action, user.id);
    submitLogEvent('bill-document', `Bill filed as ${action.action}`, correlationId, { documentId: id });
    return NextResponse.json(toClientDocument(applied), { headers: PRIVATE_NO_STORE });
  } catch (error) {
    if (error instanceof BillApplyError) return NextResponse.json({ error: error.message }, { status: 400 });
    submitLogEvent('bill-document', `Error filing bill: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { documentId: id }, true);
    return NextResponse.json({ error: 'Failed to file the bill' }, { status: 500 });
  }
}
