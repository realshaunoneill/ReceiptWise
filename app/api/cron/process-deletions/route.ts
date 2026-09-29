import { type NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { randomUUID } from 'crypto';
import { and, eq, isNotNull, lte } from 'drizzle-orm';
import { del } from '@vercel/blob';
import { clerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { receipts, users } from '@/lib/db/schema';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { HouseholdService } from '@/lib/services/household-service';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Users processed per run. Deletion is not time-critical (the window is 24h and the job
 * runs daily), so a bounded batch keeps us inside maxDuration. Anything left over is
 * picked up on the next run.
 */
const MAX_USERS_PER_RUN = 25;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

/**
 * Constant-time comparison of the cron bearer token. Fails closed when CRON_SECRET is
 * unset so a misconfigured deploy can't expose an unauthenticated destructive endpoint.
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const provided = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const TERMINAL_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>(['canceled', 'incomplete_expired']);

/**
 * Cancel every non-cancelled Stripe subscription for a customer.
 * Without this, a deleted account keeps getting billed.
 */
async function cancelStripeSubscriptions(
  stripeCustomerId: string,
  correlationId: CorrelationId,
): Promise<void> {
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'all',
    limit: 100,
  });

  for (const subscription of subscriptions.data) {
    // Terminal statuses can't be cancelled — Stripe rejects the call, which would fail this
    // user's deletion on every run for ever.
    if (TERMINAL_SUBSCRIPTION_STATUSES.has(subscription.status)) continue;
    await stripe.subscriptions.cancel(subscription.id);
    submitLogEvent('subscription', `Cancelled subscription ${subscription.id} for account deletion`, correlationId, {
      stripeCustomerId,
      subscriptionId: subscription.id,
    });
  }
}

/**
 * Delete every stored receipt image for a user. Blob objects are not covered by the
 * database FK cascade, so without this the images outlive the account.
 */
async function deleteReceiptBlobs(userId: string, correlationId: CorrelationId): Promise<void> {
  const rows = await db
    .select({ imageUrl: receipts.imageUrl })
    .from(receipts)
    .where(eq(receipts.userId, userId));

  const urls = rows.map(r => r.imageUrl).filter((u): u is string => Boolean(u));
  if (urls.length === 0) return;

  // del() accepts up to 1000 urls per call.
  for (let i = 0; i < urls.length; i += 1000) {
    await del(urls.slice(i, i + 1000));
  }

  submitLogEvent('user', `Deleted ${urls.length} receipt blobs for account deletion`, correlationId, {
    userId,
    blobCount: urls.length,
  });
}

/**
 * Delete the Clerk identity. Treated as idempotent: an already-deleted user is success,
 * so a partially-failed previous run can be retried safely.
 */
async function deleteClerkUser(clerkId: string, correlationId: CorrelationId): Promise<void> {
  try {
    const client = await clerkClient();
    await client.users.deleteUser(clerkId);
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status === 404) {
      submitLogEvent('user', 'Clerk user already deleted, continuing', correlationId, { clerkId });
      return;
    }
    throw error;
  }
}

/**
 * GET /api/cron/process-deletions
 *
 * Hard-deletes accounts whose 24h deletion window has elapsed. Vercel Cron issues GET
 * requests with the CRON_SECRET as a bearer token.
 *
 * External cleanup (Stripe, Blob, Clerk) runs before the database row is removed, because
 * the row holds the identifiers those systems need. If any step fails the row is left in
 * place and retried on the next run rather than orphaning remote data.
 */
export async function GET(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  if (!isAuthorized(req)) {
    submitLogEvent('user', 'Unauthorized call to process-deletions cron', correlationId, {}, true);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const due = await db
      .select()
      .from(users)
      .where(
        and(
          isNotNull(users.deletionScheduledAt),
          lte(users.deletionScheduledAt, new Date()),
        ),
      )
      .limit(MAX_USERS_PER_RUN);

    if (due.length === 0) {
      return NextResponse.json({ processed: 0, failed: 0 });
    }

    submitLogEvent('user', `Processing ${due.length} scheduled account deletions`, correlationId, {
      userCount: due.length,
    });

    let processed = 0;
    const failed: string[] = [];

    for (const user of due) {
      try {
        if (user.stripeCustomerId) {
          await cancelStripeSubscriptions(user.stripeCustomerId, correlationId);
        }

        await deleteReceiptBlobs(user.id, correlationId);

        // Before the row goes: a household this person owns passes to its longest-standing
        // other member, or is deleted (keeping everyone else's receipts) if they were alone in
        // it. Otherwise the membership cascade left households with members and no owner, which
        // nobody could then manage, invite to or delete.
        const released = await HouseholdService.releaseOwnedHouseholds(user.id);
        if (released.transferred > 0 || released.deleted > 0) {
          submitLogEvent('household', 'Released households owned by deleted account', correlationId, {
            userId: user.id,
            ...released,
          });
        }

        await deleteClerkUser(user.clerkId, correlationId);

        // Receipts, items, household memberships, invitations, api keys and insights
        // cache all cascade from this row.
        await db.delete(users).where(eq(users.id, user.id));

        processed++;
        submitLogEvent('user', 'Account permanently deleted', correlationId, { userId: user.id });
      } catch (error) {
        failed.push(user.id);
        // Left in place deliberately — the next run retries it.
        submitLogEvent(
          'user',
          `Failed to delete account: ${error instanceof Error ? error.message : 'Unknown error'}`,
          correlationId,
          { userId: user.id, error: error instanceof Error ? error.stack : undefined },
          true,
        );
      }
    }

    return NextResponse.json({ processed, failed: failed.length });
  } catch (error) {
    submitLogEvent(
      'user',
      `process-deletions cron failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      correlationId,
      { error: error instanceof Error ? error.stack : undefined },
      true,
    );
    return NextResponse.json({ error: 'Cron run failed' }, { status: 500 });
  }
}
