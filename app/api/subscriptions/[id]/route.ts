import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { billDocuments, subscriptions, subscriptionPayments } from '@/lib/db/schema';
import { and, eq, desc, isNull } from 'drizzle-orm';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { getAccount } from '@/lib/services/account-service';
import { canFileFinanceRowUnder, canOwnFinanceRow, canReadFinanceRow } from '@/lib/services/finance-access';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { nextAmounts } from '../next-amount';
import { utcDay } from '@/lib/schedule/billing-schedule';
import { invalidateInsightsCache } from '@/lib/utils/cache-helpers';
import { parseBody, readJson, updateSubscriptionSchema } from '@/lib/validation/finance';

export const runtime = 'nodejs';

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

const NOT_FOUND = { error: 'Subscription not found' };

/** Same instant, or both empty. */
function sameTime(a: Date | null | undefined, b: Date | null | undefined): boolean {
  return (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);
}

// GET /api/subscriptions/[id] - One subscription or bill with its recent payments and the bills
// filed against it (their files are at /api/bills/documents/[id]/file). Readable by its owner
// and, when shared, by every member of a covered household.
export async function GET(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: false });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { id } = await params;

  try {
    const subscription = await SubscriptionService.getById(id);
    if (!subscription || !canReadFinanceRow(subscription, user.id, entitlements)) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }

    const [payments, filed, ownAmounts] = await Promise.all([
      db
        .select()
        .from(subscriptionPayments)
        .where(eq(subscriptionPayments.subscriptionId, id))
        .orderBy(desc(subscriptionPayments.expectedDate))
        .limit(24),
      db
        .select({
          id: billDocuments.id,
          userId: billDocuments.userId,
          householdId: billDocuments.householdId,
          paymentId: billDocuments.paymentId,
          fileName: billDocuments.fileName,
          provider: billDocuments.provider,
          amountDue: billDocuments.amountDue,
          currency: billDocuments.currency,
          dueDate: billDocuments.dueDate,
          issueDate: billDocuments.issueDate,
          periodStart: billDocuments.periodStart,
          periodEnd: billDocuments.periodEnd,
        })
        .from(billDocuments)
        .where(and(eq(billDocuments.subscriptionId, id), eq(billDocuments.reviewStatus, 'applied'), isNull(billDocuments.deletedAt)))
        .orderBy(desc(billDocuments.createdAt))
        .limit(24),
      nextAmounts([subscription]),
    ]);
    // A household member's bill filed against a shared item is only listed to those who can open it.
    const bills = filed
      .filter((bill) => canReadFinanceRow(bill, user.id, entitlements))
      .map(({ userId: _userId, householdId: _householdId, ...bill }) => bill);

    return NextResponse.json(
      { ...subscription, nextAmount: ownAmounts.get(subscription.id) ?? null, payments, bills, canEdit: canOwnFinanceRow(subscription, user.id, entitlements) },
      { headers: PRIVATE_NO_STORE },
    );
  } catch (error) {
    submitLogEvent('subscription', `Error fetching subscription: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 },
    );
  }
}

// PATCH /api/subscriptions/[id] - Update (owner only)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: true });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { id } = await params;

  try {
    const existing = await SubscriptionService.getById(id);
    if (!existing || !canReadFinanceRow(existing, user.id, entitlements)) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }
    if (!canOwnFinanceRow(existing, user.id, entitlements)) {
      return NextResponse.json({ error: 'Only the person who added this can change it' }, { status: 403 });
    }

    const parsed = parseBody(updateSubscriptionSchema, await readJson(req));
    if (parsed instanceof NextResponse) return parsed;
    const input = parsed.data;

    if (input.householdId !== undefined && input.householdId !== existing.householdId) {
      if (!(await canFileFinanceRowUnder(input.householdId ?? null, user.id, entitlements))) {
        return NextResponse.json(
          { error: input.householdId ? 'Not a member of this household' : 'Active subscription required' },
          { status: 403 },
        );
      }
    }

    if (input.paidFromAccountId && input.paidFromAccountId !== existing.paidFromAccountId) {
      const account = await getAccount(input.paidFromAccountId);
      if (!account || !canReadFinanceRow(account, user.id, entitlements)) {
        return NextResponse.json({ error: 'paidFromAccountId is not one of your accounts' }, { status: 400 });
      }
    }

    const updates: Partial<typeof subscriptions.$inferInsert> = {};
    for (const key of [
      'name', 'description', 'category', 'amount', 'currency', 'billingFrequency', 'billingDay',
      'customFrequencyDays', 'startDate', 'endDate', 'householdId', 'isBusinessExpense', 'website',
      'notes', 'kind', 'amountType', 'paymentMethod', 'accountReference', 'paidFromAccountId',
    ] as const) {
      if (input[key] !== undefined) (updates as Record<string, unknown>)[key] = input[key];
    }

    const frequency = input.billingFrequency ?? existing.billingFrequency;
    if (frequency === 'custom' && !(input.customFrequencyDays ?? existing.customFrequencyDays)) {
      return NextResponse.json({ error: 'customFrequencyDays is required for a custom frequency' }, { status: 400 });
    }
    if (frequency === 'once' && (input.startDate || input.billingFrequency)) {
      updates.billingDay = (input.startDate ?? existing.startDate).getUTCDate();
    }

    // Status changes
    const now = new Date();
    const status = input.status ?? existing.status;
    if (input.status !== undefined) updates.status = input.status;
    if (status === 'cancelled' && existing.status !== 'cancelled' && input.endDate === undefined && !existing.endDate) {
      updates.endDate = utcDay(now);
    }
    // Resuming a cancelled subscription must clear the end date cancelling set, or the schedule
    // still stops there and nextBillingDate stays in the past.
    if (status === 'active' && existing.status === 'cancelled' && input.endDate === undefined) {
      updates.endDate = null;
    }
    if (status === 'paused' && existing.status !== 'paused') updates.pausedAt = now;
    if (status !== 'paused' && existing.status === 'paused') updates.pausedAt = null;

    // Only regenerate when the schedule really changed. The edit dialog used to send every field,
    // so renaming a subscription deleted its pending and missed rows (and their notes).
    const scheduleChanged =
      (updates.billingFrequency !== undefined && updates.billingFrequency !== existing.billingFrequency) ||
      (updates.billingDay !== undefined && updates.billingDay !== existing.billingDay) ||
      (updates.customFrequencyDays !== undefined && updates.customFrequencyDays !== existing.customFrequencyDays) ||
      (updates.startDate !== undefined && !sameTime(updates.startDate, existing.startDate)) ||
      (updates.endDate !== undefined && !sameTime(updates.endDate, existing.endDate));
    const amountChanged = updates.amount !== undefined && updates.amount !== existing.amount;

    updates.updatedAt = now;
    const [updated] = await db
      .update(subscriptions)
      .set(updates)
      .where(eq(subscriptions.id, id))
      .returning();

    if (amountChanged) {
      await SubscriptionService.updateEstimatedAmounts(id, updated.amount);
    }

    // The cycles that fell while it was paused are marked skipped, not backfilled as missed.
    if (existing.status === 'paused' && updated.status === 'active' && existing.pausedAt) {
      await SubscriptionService.skipCyclesBetween(updated, existing.pausedAt, new Date(utcDay(now).getTime() - 1));
    }

    const reactivated = updated.status === 'active' && existing.status !== 'active';
    if (scheduleChanged) {
      await SubscriptionService.dropRegenerableRows(id);
    }
    if (updated.status === 'active' && (scheduleChanged || reactivated)) {
      const paymentsCreated = await SubscriptionService.generateExpectedPayments(id);
      submitLogEvent('subscription', `Regenerated ${paymentsCreated} payments after a schedule change`, correlationId, { subscriptionId: id });
    } else if (scheduleChanged || status !== existing.status) {
      await SubscriptionService.refreshNextBillingDate(id);
    }

    const refreshed = await SubscriptionService.getById(id);

    submitLogEvent('subscription', `Updated subscription: ${id}`, correlationId, { subscriptionId: id });

    await invalidateInsightsCache(user.id, existing.householdId || undefined, correlationId);

    return NextResponse.json(refreshed ?? updated, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('subscription', `Error updating subscription: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 },
    );
  }
}

// DELETE /api/subscriptions/[id] - Delete (owner only). Its payments go with it (FK cascade).
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: false });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { id } = await params;

  try {
    const existing = await SubscriptionService.getById(id);
    if (!existing || !canReadFinanceRow(existing, user.id, entitlements)) {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }
    if (!canOwnFinanceRow(existing, user.id, entitlements)) {
      return NextResponse.json({ error: 'Only the person who added this can delete it' }, { status: 403 });
    }

    await db.delete(subscriptions).where(eq(subscriptions.id, id));

    submitLogEvent('subscription', `Deleted subscription: ${id}`, correlationId, { subscriptionId: id });

    await invalidateInsightsCache(user.id, existing.householdId || undefined, correlationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    submitLogEvent('subscription', `Error deleting subscription: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to delete subscription' },
      { status: 500 },
    );
  }
}
