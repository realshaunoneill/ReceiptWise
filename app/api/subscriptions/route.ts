import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscriptions, subscriptionPayments } from '@/lib/db/schema';
import { eq, and, asc, desc, inArray } from 'drizzle-orm';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { getAccount } from '@/lib/services/account-service';
import { canFileFinanceRowUnder, canReadFinanceRow, financeScopeCondition, type FinanceScope } from '@/lib/services/finance-access';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { invalidateInsightsCache } from '@/lib/utils/cache-helpers';
import { nextAmounts } from './next-amount';
import { createSubscriptionSchema, parseBody, readJson, SUBSCRIPTION_KINDS, SUBSCRIPTION_STATUSES } from '@/lib/validation/finance';

export const runtime = 'nodejs';

/** Unsettled payments returned per subscription with ?includePayments=true. */
const RECENT_PAYMENTS = 12;

// GET /api/subscriptions - List subscriptions and bills
//   ?householdId=  that household's shared rows, from every member (else: your own rows)
//   ?status=       active | paused | cancelled
//   ?kind=         subscription | bill
//   ?includePayments=true  adds recentPayments (unsettled) and missingPayments (overdue count)
// Every row has nextAmount: the next cycle's own amount when it has one (a filed bill, or typed in
// for that month), else null for the usual one.
export async function GET(req: NextRequest) {
  const guard = await guardFinanceRoute(req, { mutating: false });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;

  try {
    const { searchParams } = new URL(req.url);
    const householdId = searchParams.get('householdId');
    const status = searchParams.get('status');
    const kind = searchParams.get('kind');
    const includePayments = searchParams.get('includePayments') === 'true';

    if (status && !(SUBSCRIPTION_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: 'status must be active, paused or cancelled' }, { status: 400 });
    }
    if (kind && !(SUBSCRIPTION_KINDS as readonly string[]).includes(kind)) {
      return NextResponse.json({ error: 'kind must be subscription or bill' }, { status: 400 });
    }

    const scope: FinanceScope = householdId ? { type: 'household', householdId } : { type: 'mine' };
    const scopeCondition = financeScopeCondition(subscriptions, user.id, scope, entitlements);
    if (!scopeCondition) {
      return NextResponse.json({ error: householdId ? 'Not a member of this household' : 'Active subscription required' }, { status: 403 });
    }

    const conditions = [scopeCondition];
    if (status) conditions.push(eq(subscriptions.status, status));
    if (kind) conditions.push(eq(subscriptions.kind, kind));

    // Payment rows are created by the daily job (/api/cron/bills-daily), not here: doing it on
    // every list request, with no lock, is how two tabs created the same cycle twice.
    const rows = await db
      .select()
      .from(subscriptions)
      .where(and(...conditions))
      .orderBy(asc(subscriptions.nextBillingDate));

    const ownAmounts = await nextAmounts(rows);
    const withNext = rows.map((row) => ({ ...row, nextAmount: ownAmounts.get(row.id) ?? null }));

    if (!includePayments || rows.length === 0) {
      return NextResponse.json(withNext, { headers: PRIVATE_NO_STORE });
    }

    const unsettled = await db
      .select()
      .from(subscriptionPayments)
      .where(and(
        inArray(subscriptionPayments.subscriptionId, rows.map((s) => s.id)),
        inArray(subscriptionPayments.status, ['pending', 'missed']),
      ))
      .orderBy(desc(subscriptionPayments.expectedDate));

    const paymentsBySubscription = new Map<string, typeof unsettled>();
    for (const payment of unsettled) {
      const list = paymentsBySubscription.get(payment.subscriptionId) ?? [];
      if (list.length < RECENT_PAYMENTS) list.push(payment);
      paymentsBySubscription.set(payment.subscriptionId, list);
    }

    const now = new Date();
    return NextResponse.json(
      withNext.map((subscription) => {
        const payments = paymentsBySubscription.get(subscription.id) ?? [];
        return {
          ...subscription,
          missingPayments: payments.filter((p) => SubscriptionService.isOverdue(p, now, subscription.paymentMethod)).length,
          recentPayments: payments,
        };
      }),
      { headers: PRIVATE_NO_STORE },
    );
  } catch (error) {
    submitLogEvent('subscription', `Error fetching subscriptions: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 },
    );
  }
}

// POST /api/subscriptions - Create a subscription or bill
export async function POST(req: NextRequest) {
  const guard = await guardFinanceRoute(req, { mutating: true });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;

  try {
    const parsed = parseBody(createSubscriptionSchema, await readJson(req));
    if (parsed instanceof NextResponse) return parsed;
    const input = parsed.data;

    const householdId = input.householdId ?? null;
    if (!(await canFileFinanceRowUnder(householdId, user.id, entitlements))) {
      return NextResponse.json(
        { error: householdId ? 'Not a member of this household' : 'Active subscription required' },
        { status: 403 },
      );
    }

    if (input.paidFromAccountId) {
      const account = await getAccount(input.paidFromAccountId);
      if (!account || !canReadFinanceRow(account, user.id, entitlements)) {
        return NextResponse.json({ error: 'paidFromAccountId is not one of your accounts' }, { status: 400 });
      }
    }

    // A one-off falls on its start date, so its "billing day" is that day.
    const billingDay = input.billingFrequency === 'once' ? input.startDate.getUTCDate() : input.billingDay!;
    const schedule = {
      startDate: input.startDate,
      billingFrequency: input.billingFrequency,
      billingDay,
      customFrequencyDays: input.billingFrequency === 'custom' ? input.customFrequencyDays ?? null : null,
      endDate: input.endDate ?? null,
    };

    const [newSubscription] = await db
      .insert(subscriptions)
      .values({
        userId: user.id,
        householdId,
        name: input.name,
        description: input.description ?? null,
        category: input.category ?? null,
        amount: input.amount,
        currency: input.currency,
        ...schedule,
        status: input.status ?? 'active',
        nextBillingDate: SubscriptionService.computeNextBillingDate(schedule),
        isBusinessExpense: input.isBusinessExpense,
        website: input.website ?? null,
        notes: input.notes ?? null,
        kind: input.kind,
        amountType: input.amountType,
        paymentMethod: input.paymentMethod ?? null,
        accountReference: input.accountReference ?? null,
        paidFromAccountId: input.paidFromAccountId ?? null,
      })
      .returning();

    // Rows for the cycles already past (a start date in the past), so they can be reconciled.
    const paymentsCreated = await SubscriptionService.generateExpectedPayments(newSubscription.id);

    submitLogEvent('subscription', `Created subscription ${newSubscription.id} with ${paymentsCreated} expected payments`, correlationId, { subscriptionId: newSubscription.id });

    await invalidateInsightsCache(user.id, householdId ?? undefined, correlationId);

    const [created] = await db.select().from(subscriptions).where(eq(subscriptions.id, newSubscription.id)).limit(1);
    return NextResponse.json(created ?? newSubscription, { status: 201, headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('subscription', `Error creating subscription: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 },
    );
  }
}
