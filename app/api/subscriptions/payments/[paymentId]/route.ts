import { type NextRequest, NextResponse } from 'next/server';
import { requireReceiptAccess } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { subscriptionPayments, receipts } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { canReadFinanceRow } from '@/lib/services/finance-access';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { invalidateInsightsCache } from '@/lib/utils/cache-helpers';
import { parseBody, readJson, updatePaymentSchema } from '@/lib/validation/finance';

export const runtime = 'nodejs';

type RouteParams = {
  params: Promise<{
    paymentId: string;
  }>;
};

const NOT_FOUND = { error: 'Payment not found' };

// PATCH /api/subscriptions/payments/[paymentId] - Link a receipt, mark paid/skipped/pending, or
// set this occurrence's amount or due date. Allowed for anyone who can see the subscription, so
// either person in a household can tick off a shared bill.
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: true });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { paymentId } = await params;

  try {
    const row = await SubscriptionService.getPaymentWithSubscription(paymentId);
    if (!row || !canReadFinanceRow(row.subscription, user.id, entitlements)) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }

    const parsed = parseBody(updatePaymentSchema, await readJson(req));
    if (parsed instanceof NextResponse) return parsed;
    const input = parsed.data;

    let receipt;
    if (input.receiptId) {
      [receipt] = await db
        .select()
        .from(receipts)
        .where(and(eq(receipts.id, input.receiptId), isNull(receipts.deletedAt)))
        .limit(1);
      if (!receipt) {
        return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
      }
      const denied = await requireReceiptAccess(receipt, user, correlationId);
      if (denied) return denied;
    }

    const updated = await SubscriptionService.applyPaymentChange(row.payment, input, user.id, receipt);

    submitLogEvent(
      'subscription',
      receipt ? `Linked receipt ${receipt.id} to payment ${paymentId}` : `Updated payment ${paymentId}`,
      correlationId,
      { paymentId, subscriptionId: row.subscription.id, status: updated.status },
    );

    await invalidateInsightsCache(user.id, row.subscription.householdId || undefined, correlationId);

    return NextResponse.json(updated, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('subscription', `Error updating payment: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to update payment' },
      { status: 500 },
    );
  }
}

// DELETE /api/subscriptions/payments/[paymentId] - Unlink the receipt and reset to pending
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: false });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { paymentId } = await params;

  try {
    const row = await SubscriptionService.getPaymentWithSubscription(paymentId);
    if (!row || !canReadFinanceRow(row.subscription, user.id, entitlements)) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }

    const [updated] = await db
      .update(subscriptionPayments)
      .set({
        receiptId: null,
        actualDate: null,
        actualAmount: null,
        paidVia: null,
        status: 'pending',
        markedByUserId: user.id,
        updatedAt: new Date(),
      })
      .where(eq(subscriptionPayments.id, paymentId))
      .returning();

    // The cycle is open again, so it may be the next billing date once more.
    await SubscriptionService.refreshNextBillingDate(row.subscription.id);

    submitLogEvent('subscription', `Unlinked receipt from payment ${paymentId}`, correlationId, { paymentId });

    await invalidateInsightsCache(user.id, row.subscription.householdId || undefined, correlationId);

    return NextResponse.json(updated, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('subscription', `Error unlinking payment: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to unlink payment' },
      { status: 500 },
    );
  }
}
