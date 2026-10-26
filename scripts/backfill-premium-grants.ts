// Give every user the premium_grants rows that explain their current Premium, without changing
// anyone's Premium. Run once after the premium_grants table is deployed, before anything else
// recomputes Premium from grants (lib/services/entitlement-service.ts).
//
//   npx tsx scripts/backfill-premium-grants.ts            # dry run: what it would write
//   npx tsx scripts/backfill-premium-grants.ts --apply    # write, recompute, check nothing changed
//
// DATABASE_URL and STRIPE_SECRET_KEY must be the same environment's (production with the live key,
// or the preview database with the test key). For each user:
// - with a Stripe customer: a `stripe` grant from the subscription that decides their Premium;
// - Premium today without a live Stripe subscription (testers, family, set by hand): a `comp` grant,
//   so recomputing keeps it;
// - not Premium today although Stripe has a live subscription: reported, and left alone unless
//   --fix-mismatches is given (recomputing would switch Premium on).

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { premiumGrants, users } from '../lib/db/schema';
import { isLiveGrant, stripeGrantStatus } from '../lib/entitlements';
import { recomputeSubscribed, upsertGrant } from '../lib/services/entitlement-service';
import { getDecidingSubscription } from '../lib/stripe';

const APPLY = process.argv.includes('--apply');
const FIX_MISMATCHES = process.argv.includes('--fix-mismatches');
const NOTE = 'Backfill 2026-10-26: Premium without a live Stripe subscription';

type Plan = {
  userId: string;
  email: string;
  subscribed: boolean;
  stripe: { customerId: string; status: ReturnType<typeof stripeGrantStatus>; productId: string | null; willRenew: boolean | null } | null;
  stripeLive: boolean;
  comp: boolean;
  mismatch: boolean;
  error?: string;
};

async function planFor(user: typeof users.$inferSelect): Promise<Plan> {
  const plan: Plan = { userId: user.id, email: user.email, subscribed: user.subscribed, stripe: null, stripeLive: false, comp: false, mismatch: false };
  if (user.stripeCustomerId) {
    try {
      const subscription = await getDecidingSubscription(user.stripeCustomerId);
      const status = stripeGrantStatus(subscription?.status);
      plan.stripe = {
        customerId: user.stripeCustomerId,
        status,
        productId: subscription?.items.data[0]?.price.id ?? null,
        willRenew: subscription ? !subscription.cancel_at_period_end : null,
      };
      plan.stripeLive = isLiveGrant({ source: 'stripe', status, expiresAt: null }, new Date());
    } catch (error) {
      plan.error = error instanceof Error ? error.message : String(error);
    }
  }
  plan.comp = user.subscribed && !plan.stripeLive;
  plan.mismatch = !user.subscribed && plan.stripeLive;
  return plan;
}

async function main() {
  const everyone = await db.select().from(users);
  const existing = await db.select().from(premiumGrants);
  console.log(`${everyone.length} users, ${existing.length} grants already; ${APPLY ? 'APPLYING' : 'dry run'}`);

  const plans: Plan[] = [];
  for (const user of everyone) plans.push(await planFor(user));

  const errors = plans.filter((p) => p.error);
  for (const p of plans) {
    const parts = [
      p.subscribed ? 'Premium' : 'not Premium',
      p.stripe ? `stripe ${p.stripe.status}${p.stripeLive ? ' (live)' : ''}` : 'no Stripe customer',
      p.comp ? '→ comp grant' : '',
      p.mismatch ? '!! Stripe live but not Premium' : '',
      p.error ? `!! Stripe error: ${p.error}` : '',
    ].filter(Boolean);
    console.log(`${p.userId}  ${parts.join(' · ')}`);
  }
  if (errors.length > 0) {
    console.error(`${errors.length} users could not be read from Stripe; nothing written.`);
    process.exit(1);
  }
  if (!APPLY) {
    console.log('Dry run: nothing written. Re-run with --apply.');
    process.exit(0);
  }

  const correlationId = randomUUID();
  let changed = 0;
  for (const p of plans) {
    if (p.mismatch && !FIX_MISMATCHES) continue;
    if (p.stripe) {
      await upsertGrant({ userId: p.userId, source: 'stripe', externalId: p.stripe.customerId, status: p.stripe.status, productId: p.stripe.productId, willRenew: p.stripe.willRenew });
    }
    if (p.comp) {
      await upsertGrant({ userId: p.userId, source: 'comp', externalId: p.userId, status: 'active', note: NOTE });
    }
    await recomputeSubscribed(p.userId, correlationId);
    const [row] = await db.select({ subscribed: users.subscribed }).from(users).where(eq(users.id, p.userId));
    if (row.subscribed !== p.subscribed && !p.mismatch) {
      console.error(`!! ${p.userId} changed from ${p.subscribed} to ${row.subscribed}`);
      changed++;
    }
  }
  console.log(changed === 0 ? 'Done: nobody\'s Premium changed.' : `${changed} users' Premium changed: investigate.`);
  process.exit(changed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
