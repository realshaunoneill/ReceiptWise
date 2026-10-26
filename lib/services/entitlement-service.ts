import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { premiumGrants, users, type PremiumGrant } from '@/lib/db/schema';
import { decidePremium, type GrantSource, type GrantStatus } from '@/lib/entitlements';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';

/**
 * Premium grants in the database, and the one place users.subscribed is written. Each source
 * (Stripe sync, the app stores through RevenueCat, comp grants) records its own row, then calls
 * recomputeSubscribed, which looks at all of them (rules in lib/entitlements.ts).
 */

export type GrantInput = {
  userId: string;
  source: GrantSource;
  externalId: string;
  status: GrantStatus;
  productId?: string | null;
  expiresAt?: Date | null;
  willRenew?: boolean | null;
  environment?: string | null;
  note?: string | null;
};

/** Record a source's current state: one row per (source, external id), replaced each time. */
export async function upsertGrant(input: GrantInput): Promise<PremiumGrant> {
  const state = {
    userId: input.userId,
    status: input.status,
    productId: input.productId ?? null,
    expiresAt: input.expiresAt ?? null,
    willRenew: input.willRenew ?? null,
    environment: input.environment ?? null,
    note: input.note ?? null,
    updatedAt: new Date(),
  };
  const [grant] = await db
    .insert(premiumGrants)
    .values({ ...state, source: input.source, externalId: input.externalId })
    // The user too: a Stripe customer re-associated by email moves to the account it now belongs to.
    .onConflictDoUpdate({ target: [premiumGrants.source, premiumGrants.externalId], set: state })
    .returning();
  return grant;
}

export type PremiumState = { subscribed: boolean; source: GrantSource | null; changed: boolean };

/** Set users.subscribed from every grant the user has. Writes only when it changes. */
export async function recomputeSubscribed(userId: string, correlationId: CorrelationId): Promise<PremiumState> {
  const grants = await db.select().from(premiumGrants).where(eq(premiumGrants.userId, userId));
  const { premium, grant } = decidePremium(grants, new Date());
  const [changed] = await db
    .update(users)
    .set({ subscribed: premium, updatedAt: new Date() })
    .where(and(eq(users.id, userId), ne(users.subscribed, premium)))
    .returning({ id: users.id });
  if (changed) {
    submitLogEvent('subscription', `Premium ${premium ? 'on' : 'off'} for user ${userId}`, correlationId, {
      userId,
      subscribed: premium,
      source: grant?.source ?? null,
    });
  }
  return { subscribed: premium, source: (grant?.source as GrantSource | undefined) ?? null, changed: Boolean(changed) };
}

/** Premium given by hand (testers, App Review, family), until a date or with no end. */
export async function grantComp(
  userId: string,
  { until = null, note = null }: { until?: Date | null; note?: string | null },
  correlationId: CorrelationId,
): Promise<PremiumState> {
  await upsertGrant({ userId, source: 'comp', externalId: userId, status: 'active', expiresAt: until, note });
  return recomputeSubscribed(userId, correlationId);
}

/** End Premium given by hand. Premium from a paid source is unaffected. */
export async function revokeComp(userId: string, correlationId: CorrelationId): Promise<PremiumState> {
  await db
    .update(premiumGrants)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(and(eq(premiumGrants.source, 'comp'), eq(premiumGrants.externalId, userId)));
  return recomputeSubscribed(userId, correlationId);
}
