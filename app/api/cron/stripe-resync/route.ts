import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { asc, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { isCronAuthorized } from '@/lib/cron-auth';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { syncStripeDataToDatabase } from '@/lib/stripe';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Customers checked per run. Far more than there are; the rest would wait a day. */
const MAX_CUSTOMERS_PER_RUN = 500;

/**
 * GET /api/cron/stripe-resync (daily, in the 02:00 wake with bills-daily): every account with a
 * Stripe customer, synced from Stripe again. Premium follows Stripe through the webhook; this puts
 * it right within a day when an event was lost after Stripe's retries, or the webhook secret was
 * wrong, which otherwise left Premium on or off for good. syncStripeDataToDatabase only writes
 * what Stripe says, so running it on an account that's right changes nothing.
 */
export async function GET(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  if (!isCronAuthorized(req)) {
    submitLogEvent('cron', 'Unauthorized call to stripe-resync cron', correlationId, {}, true);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await db
    .select({ userId: users.id, customerId: users.stripeCustomerId, subscribed: users.subscribed })
    .from(users)
    .where(isNotNull(users.stripeCustomerId))
    .orderBy(asc(users.createdAt))
    .limit(MAX_CUSTOMERS_PER_RUN);

  let changed = 0;
  const failed: string[] = [];
  for (const row of rows) {
    try {
      await syncStripeDataToDatabase(row.customerId!, correlationId);
      const [after] = await db.select({ subscribed: users.subscribed }).from(users).where(eq(users.id, row.userId));
      if (after && after.subscribed !== row.subscribed) {
        changed++;
        // The webhook should have done this: worth knowing which way and for whom.
        submitLogEvent('cron', `Stripe resync turned Premium ${after.subscribed ? 'on' : 'off'} for user ${row.userId}`, correlationId, { userId: row.userId }, true);
      }
    } catch (error) {
      failed.push(row.userId);
      submitLogEvent('cron', `Stripe resync failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { userId: row.userId }, true);
    }
  }
  return NextResponse.json({ checked: rows.length, changed, failed: failed.length });
}
