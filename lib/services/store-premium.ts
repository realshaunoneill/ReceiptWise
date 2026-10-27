import { and, eq, inArray, notInArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { premiumGrants } from '@/lib/db/schema';
import { decidePremium, type GrantSource } from '@/lib/entitlements';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { getSubscriber, grantsFromSubscriber } from '@/lib/revenuecat';
import { recomputeSubscribed, upsertGrant, type PremiumState } from '@/lib/services/entitlement-service';

const STORE_SOURCES = ['app_store', 'play_store'] as const;

/**
 * Look again at a person's App Store and Google Play subscriptions (RevenueCat), record them as
 * grants and recompute Premium. A store grant RevenueCat no longer lists for them (the purchase
 * was transferred to another account, or removed) is ended, so it can't keep Premium on.
 */
export async function syncStorePremium(userId: string, correlationId: CorrelationId): Promise<PremiumState> {
  const subscriber = await getSubscriber(userId);
  const grants = grantsFromSubscriber(userId, subscriber, new Date());
  for (const grant of grants) await upsertGrant(grant);

  const listed = grants.map((grant) => grant.externalId);
  await db
    .update(premiumGrants)
    .set({ status: 'none', willRenew: false, updatedAt: new Date() })
    .where(and(
      eq(premiumGrants.userId, userId),
      inArray(premiumGrants.source, [...STORE_SOURCES]),
      listed.length > 0 ? notInArray(premiumGrants.externalId, listed) : undefined,
    ));

  const state = await recomputeSubscribed(userId, correlationId);
  submitLogEvent('subscription', `Store Premium synced for user ${userId}: ${grants.length} subscription(s), Premium ${state.subscribed ? 'on' : 'off'}`, correlationId, {
    userId,
    stores: grants.map((grant) => `${grant.source}:${grant.status}`),
  });
  return state;
}

/** Whether a store subscription gives this person Premium now: the website mustn't sell a second one. */
export async function hasLiveStoreGrant(userId: string): Promise<GrantSource | null> {
  const grants = await db
    .select()
    .from(premiumGrants)
    .where(and(eq(premiumGrants.userId, userId), inArray(premiumGrants.source, [...STORE_SOURCES])));
  const { grant } = decidePremium(grants, new Date());
  return (grant?.source as GrantSource | undefined) ?? null;
}

/** Premium as Settings describes it: where it comes from, and when it renews or ends. */
export type PremiumSummary = {
  active: boolean;
  source: GrantSource | null;
  productId: string | null;
  expiresAt: Date | null;
  willRenew: boolean | null;
  inTrial: boolean;
};

export async function premiumSummary(userId: string): Promise<PremiumSummary> {
  const grants = await db.select().from(premiumGrants).where(eq(premiumGrants.userId, userId));
  const { premium, grant } = decidePremium(grants, new Date());
  return {
    active: premium,
    source: (grant?.source as GrantSource | undefined) ?? null,
    productId: grant?.productId ?? null,
    expiresAt: grant?.expiresAt ?? null,
    willRenew: grant?.willRenew ?? null,
    inTrial: grant?.status === 'trialing',
  };
}
