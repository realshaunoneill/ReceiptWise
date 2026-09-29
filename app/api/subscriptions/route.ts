import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, getHouseholdMembership, requireSubscription } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { subscriptions, subscriptionPayments } from '@/lib/db/schema';
import { eq, and, or, desc, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { invalidateInsightsCache } from '@/lib/utils/cache-helpers';

export const runtime = 'nodejs';

// GET /api/subscriptions - List all subscriptions
export async function GET(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // Require active subscription
    const subCheck = await requireSubscription(user);
    if (subCheck) return subCheck;

    // Note: Payment generation moved to after fetching user's subscriptions
    // to avoid processing all subscriptions in the system

    const { searchParams } = new URL(req.url);
    const householdId = searchParams.get('householdId');
    const status = searchParams.get('status'); // 'active', 'paused', 'cancelled'
    const includePayments = searchParams.get('includePayments') === 'true';

    // Build query conditions
    const conditions = [eq(subscriptions.userId, user.id)];

    if (householdId) {
      conditions.push(eq(subscriptions.householdId, householdId));
    }

    if (status) {
      conditions.push(eq(subscriptions.status, status));
    }

    // Fetch subscriptions (re-sorted below once nextBillingDate is corrected)
    const userSubscriptions = await db
      .select()
      .from(subscriptions)
      .where(and(...conditions))
      .orderBy(desc(subscriptions.nextBillingDate));

    // Fill in any billing cycles that have come round since the last visit and correct each
    // nextBillingDate, then flag overdue ones — both scoped to this user's subscriptions.
    const { nextBillingDates } = await SubscriptionService.generateExpectedPaymentsBatch(userSubscriptions);
    for (const subscription of userSubscriptions) {
      const corrected = nextBillingDates.get(subscription.id);
      if (corrected) subscription.nextBillingDate = corrected;
    }
    await SubscriptionService.updateMissedPayments(userSubscriptions.map(s => s.id));
    userSubscriptions.sort((a, b) => new Date(b.nextBillingDate).getTime() - new Date(a.nextBillingDate).getTime());

    // Optionally include payment information
    if (includePayments && userSubscriptions.length > 0) {
      // Get all subscription IDs
      const subscriptionIds = userSubscriptions.map(s => s.id);

      // Fetch all payments in one query using inArray
      const allPayments = await db
        .select()
        .from(subscriptionPayments)
        .where(
          and(
            inArray(subscriptionPayments.subscriptionId, subscriptionIds),
            or(
              eq(subscriptionPayments.status, 'pending'),
              eq(subscriptionPayments.status, 'missed'),
            ),
          ),
        )
        .orderBy(desc(subscriptionPayments.expectedDate))
        .limit(12 * subscriptionIds.length);

      // Group payments by subscription ID
      const paymentsBySubscription = new Map<string, typeof allPayments>();
      allPayments.forEach(payment => {
        if (!paymentsBySubscription.has(payment.subscriptionId)) {
          paymentsBySubscription.set(payment.subscriptionId, []);
        }
        const subPayments = paymentsBySubscription.get(payment.subscriptionId)!;
        if (subPayments.length < 12) {
          subPayments.push(payment);
        }
      });

      // Map payments to subscriptions
      const subsWithPayments = userSubscriptions.map(subscription => {
        const payments = paymentsBySubscription.get(subscription.id) || [];
        return {
          ...subscription,
          missingPayments: payments.filter(p => p.status === 'pending' || p.status === 'missed').length,
          recentPayments: payments,
        };
      });

      return NextResponse.json(subsWithPayments);
    }

    return NextResponse.json(userSubscriptions);
  } catch (error) {
    submitLogEvent('subscription', `Error fetching subscriptions: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 },
    );
  }
}

// POST /api/subscriptions - Create new subscription
export async function POST(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // Require active subscription
    const subCheck = await requireSubscription(user);
    if (subCheck) return subCheck;

    const body = await req.json();
    const {
      name,
      description,
      category,
      amount,
      currency = 'EUR',
      billingFrequency,
      billingDay,
      customFrequencyDays,
      startDate,
      householdId,
      isBusinessExpense = false,
      website,
      notes,
    } = body;

    // Validation
    if (!name || !amount || !billingFrequency || !billingDay || !startDate) {
      return NextResponse.json(
        { error: 'Missing required fields: name, amount, billingFrequency, billingDay, startDate' },
        { status: 400 },
      );
    }

    if (!['monthly', 'quarterly', 'yearly', 'custom'].includes(billingFrequency)) {
      return NextResponse.json(
        { error: 'billingFrequency must be monthly, quarterly, yearly or custom' },
        { status: 400 },
      );
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return NextResponse.json({ error: 'amount must be a number' }, { status: 400 });
    }

    // Validate billingDay is within valid range
    if (!Number.isInteger(Number(billingDay)) || billingDay < 1 || billingDay > 31) {
      return NextResponse.json(
        { error: 'billingDay must be between 1 and 31' },
        { status: 400 },
      );
    }

    // Validate customFrequencyDays if using custom frequency
    if (billingFrequency === 'custom' && (!customFrequencyDays || customFrequencyDays < 1)) {
      return NextResponse.json(
        { error: 'customFrequencyDays must be at least 1 for custom billing frequency' },
        { status: 400 },
      );
    }

    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: 'startDate is not a valid date' }, { status: 400 });
    }

    // A subscription filed under a household must be filed under one the caller belongs to.
    if (householdId) {
      const membership = await getHouseholdMembership(householdId, user.id);
      if (!membership) {
        return NextResponse.json({ error: 'Not a member of this household' }, { status: 403 });
      }
    }

    const nextBilling = SubscriptionService.computeNextBillingDate({
      startDate: start,
      billingFrequency,
      billingDay: Number(billingDay),
      customFrequencyDays: customFrequencyDays ?? null,
      endDate: null,
    });

    // Create subscription
    const [newSubscription] = await db
      .insert(subscriptions)
      .values({
        userId: user.id,
        householdId: householdId || null,
        name,
        description,
        category,
        amount: String(amount),
        currency,
        billingFrequency,
        billingDay: Number(billingDay),
        customFrequencyDays,
        startDate: start,
        nextBillingDate: nextBilling,
        isBusinessExpense,
        website,
        notes,
      })
      .returning();

    // Generate historical payments from start date to today (for past billing cycles)
    const paymentsCreated = await SubscriptionService.generateExpectedPayments(newSubscription.id, 12, true);

    submitLogEvent('subscription', `Created subscription: ${name} with ${paymentsCreated} expected payments`, correlationId, { subscriptionId: newSubscription.id });

    // Invalidate insights cache
    await invalidateInsightsCache(user.id, householdId || undefined, correlationId);

    return NextResponse.json(newSubscription, { status: 201 });
  } catch (error) {
    submitLogEvent('subscription', `Error creating subscription: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 },
    );
  }
}
