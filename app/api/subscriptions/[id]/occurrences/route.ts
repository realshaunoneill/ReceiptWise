import { type NextRequest, NextResponse } from 'next/server';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { canReadFinanceRow } from '@/lib/services/finance-access';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { parseBody, readJson, upsertOccurrenceSchema } from '@/lib/validation/finance';

export const runtime = 'nodejs';

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

// PUT /api/subscriptions/[id]/occurrences - Act on one cycle by its date, creating its row if it
// has none yet: set next month's bill amount or due date, skip a cycle, mark one paid early.
// Body: { expectedDate: 'YYYY-MM-DD', status?, actualDate?, actualAmount?, expectedAmount?, dueDate?, notes? }
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: true });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { id } = await params;

  try {
    const subscription = await SubscriptionService.getById(id);
    if (!subscription || !canReadFinanceRow(subscription, user.id, entitlements)) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    const parsed = parseBody(upsertOccurrenceSchema, await readJson(req));
    if (parsed instanceof NextResponse) return parsed;
    const { expectedDate, ...change } = parsed.data;

    const occurrence = await SubscriptionService.findOrCreateOccurrence(subscription, expectedDate);
    if (!occurrence) {
      return NextResponse.json({ error: 'expectedDate is not one of this subscription\'s billing dates' }, { status: 400 });
    }

    const updated = await SubscriptionService.applyPaymentChange(occurrence, change, user.id);

    submitLogEvent('subscription', `Updated occurrence ${updated.id}`, correlationId, { subscriptionId: id, paymentId: updated.id, status: updated.status });

    return NextResponse.json(updated, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('subscription', `Error updating occurrence: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to update occurrence' }, { status: 500 });
  }
}
