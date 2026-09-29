import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, requireSubscription } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { subscriptions, subscriptionPayments } from '@/lib/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { SubscriptionService } from '@/lib/services/subscription-service';
import { invalidateInsightsCache } from '@/lib/utils/cache-helpers';

export const runtime = 'nodejs';

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

// GET /api/subscriptions/[id] - Get single subscription
export async function GET(req: NextRequest, { params }: RouteParams) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  const { id } = await params;

  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // Require active subscription
    const subCheck = await requireSubscription(user);
    if (subCheck) return subCheck;

    const subscription = await SubscriptionService.getSubscriptionByIdAndUserId(id, user.id);

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 },
      );
    }

    // Fetch payment history
    const payments = await db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.subscriptionId, id))
      .orderBy(desc(subscriptionPayments.expectedDate))
      .limit(24);

    return NextResponse.json({
      ...subscription,
      payments,
    });
  } catch (error) {
    submitLogEvent('subscription', `Error fetching subscription: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 },
    );
  }
}

// PATCH /api/subscriptions/[id] - Update subscription
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  const { id } = await params;

  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // Require active subscription (GET and DELETE already did; PATCH was the odd one out)
    const subCheck = await requireSubscription(user);
    if (subCheck) return subCheck;

    // Verify ownership
    const [existing] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.id, id),
          eq(subscriptions.userId, user.id),
        ),
      );

    if (!existing) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 },
      );
    }

    const body = await req.json();
    const {
      name,
      description,
      category,
      amount,
      currency,
      billingFrequency,
      billingDay,
      customFrequencyDays,
      status,
      endDate,
      isBusinessExpense,
      website,
      notes,
    } = body;

    // Build update object with only provided fields
    const updates: Partial<typeof subscriptions.$inferInsert> = {};

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (amount !== undefined) updates.amount = amount;
    if (currency !== undefined) updates.currency = currency;
    if (billingFrequency !== undefined) {
      if (!['monthly', 'quarterly', 'yearly', 'custom'].includes(billingFrequency)) {
        return NextResponse.json({ error: 'billingFrequency must be monthly, quarterly, yearly or custom' }, { status: 400 });
      }
      updates.billingFrequency = billingFrequency;
    }
    if (billingDay !== undefined) {
      if (!Number.isInteger(Number(billingDay)) || billingDay < 1 || billingDay > 31) {
        return NextResponse.json({ error: 'billingDay must be between 1 and 31' }, { status: 400 });
      }
      updates.billingDay = Number(billingDay);
    }
    if (customFrequencyDays !== undefined) updates.customFrequencyDays = customFrequencyDays;
    if (status !== undefined) updates.status = status;
    if (endDate !== undefined) updates.endDate = endDate ? new Date(endDate) : null;
    if (isBusinessExpense !== undefined) updates.isBusinessExpense = isBusinessExpense;
    if (website !== undefined) updates.website = website;
    if (notes !== undefined) updates.notes = notes;

    // Handle status changes
    if (status === 'cancelled' && !endDate && !existing.endDate) {
      updates.endDate = new Date();
    }

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(subscriptions)
      .set(updates)
      .where(
        and(
          eq(subscriptions.id, id),
          eq(subscriptions.userId, user.id),
        ),
      )
      .returning();

    // If billing details changed and subscription is active, regenerate expected payments
    const billingDetailsChanged = amount !== undefined ||
                                   billingFrequency !== undefined ||
                                   billingDay !== undefined ||
                                   customFrequencyDays !== undefined;

    const reactivated = status === 'active' && existing.status !== 'active';

    if ((billingDetailsChanged || reactivated) && updated.status === 'active') {
      if (billingDetailsChanged) {
        // Drop the unreconciled cycles (pending and missed) so they are regenerated on the new
        // schedule. Only 'pending' was removed before, so old 'missed' rows stayed at the old
        // dates alongside the new ones. Paid and cancelled cycles are the user's record and stay.
        await db
          .delete(subscriptionPayments)
          .where(
            and(
              eq(subscriptionPayments.subscriptionId, id),
              inArray(subscriptionPayments.status, ['pending', 'missed']),
            ),
          );
      }

      // Regenerates cycles up to today and recomputes nextBillingDate.
      const paymentsCreated = await SubscriptionService.generateExpectedPayments(id, 12);
      submitLogEvent('subscription', `Regenerated ${paymentsCreated} payments after billing details change`, correlationId, { subscriptionId: id });

      const [refreshed] = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
      if (refreshed) Object.assign(updated, refreshed);
    }

    submitLogEvent('subscription', `Updated subscription: ${id}`, correlationId, { subscriptionId: id });

    // Invalidate insights cache
    await invalidateInsightsCache(user.id, existing.householdId || undefined, correlationId);

    return NextResponse.json(updated);
  } catch (error) {
    submitLogEvent('subscription', `Error updating subscription: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 },
    );
  }
}

// DELETE /api/subscriptions/[id] - Delete subscription
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  const { id } = await params;

  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // Require active subscription
    const subCheck = await requireSubscription(user);
    if (subCheck) return subCheck;

    // Verify ownership
    const existing = await SubscriptionService.getSubscriptionByIdAndUserId(id, user.id);

    if (!existing) {
      return NextResponse.json(
        { error: 'Subscription not found' },
        { status: 404 },
      );
    }

    // Delete associated payments first
    await db
      .delete(subscriptionPayments)
      .where(eq(subscriptionPayments.subscriptionId, id));

    // Delete subscription
    await db
      .delete(subscriptions)
      .where(
        and(
          eq(subscriptions.id, id),
          eq(subscriptions.userId, user.id),
        ),
      );

    submitLogEvent('subscription', `Deleted subscription: ${id}`, correlationId, { subscriptionId: id });

    // Invalidate insights cache
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
