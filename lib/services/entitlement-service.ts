import { randomUUID } from 'crypto';
import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { householdUsers, premiumGrants, users, type PremiumGrant } from '@/lib/db/schema';
import {
  decideHouseholdCover,
  decidePremium,
  ENTITLED_STATUSES,
  OWN_SOURCES,
  type CoverPair,
  type GrantSource,
  type GrantStatus,
} from '@/lib/entitlements';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';

/**
 * Premium grants in the database, and the one place users.subscribed is written. Each source
 * (Stripe sync, the app stores through RevenueCat, comp grants, and household cover) records its
 * own row, then calls recomputeSubscribed, which looks at all of them (rules in lib/entitlements.ts).
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

/**
 * Set users.subscribed from every grant the user has. Writes only when it changes. Then, for
 * someone in a household, the household's cover is worked out again: their own Premium starting
 * or ending covers, or stops covering, the people they share it with. `cascade: false` is for the
 * cover itself, which only ever changes the people it covers.
 */
export async function recomputeSubscribed(
  userId: string,
  correlationId: CorrelationId,
  { cascade = true }: { cascade?: boolean } = {},
): Promise<PremiumState> {
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
  if (cascade && (await isInAnyHousehold(userId))) {
    await refreshHouseholdCover(correlationId);
    // Their own state may have moved too (their Premium ended, and someone else's now covers them).
    const after = await recomputeSubscribed(userId, correlationId, { cascade: false });
    return { ...after, changed: Boolean(changed) || after.changed };
  }
  return { subscribed: premium, source: (grant?.source as GrantSource | undefined) ?? null, changed: Boolean(changed) };
}

async function isInAnyHousehold(userId: string): Promise<boolean> {
  const [row] = await db.select({ id: householdUsers.id }).from(householdUsers).where(eq(householdUsers.userId, userId)).limit(1);
  return Boolean(row);
}

/**
 * Everyone with Premium of their own (OWN_SOURCES, live) paired with each person they share a
 * household with who has none, and when that person joined. One query for everyone: the limit on
 * how many one Premium covers runs across all of the payer's households.
 */
async function coverPairs(): Promise<CoverPair[]> {
  const own = sql.join(OWN_SOURCES.map((source) => sql`${source}`), sql`, `);
  const entitled = sql.join(ENTITLED_STATUSES.map((status) => sql`${status}`), sql`, `);
  const payers = sql`
    select distinct g.user_id from premium_grants g
    where g.source in (${own}) and g.status in (${entitled}) and (g.expires_at is null or g.expires_at > now())`;
  const rows = await db.execute<{ payer_id: string; member_id: string; joined_at: Date | string }>(sql`
    select payer.user_id as payer_id, member.user_id as member_id, member.created_at as joined_at
    from household_users payer
    join household_users member on member.household_id = payer.household_id and member.user_id <> payer.user_id
    where payer.user_id in (${payers}) and member.user_id not in (${payers})`);
  return [...rows].map((row) => ({ payerId: row.payer_id, memberId: row.member_id, joinedAt: new Date(row.joined_at) }));
}

/** Who household cover should cover now (member → payer), and the household grants as they stand. */
export async function householdCoverPlan() {
  const cover = decideHouseholdCover(await coverPairs());
  const existing = await db
    .select({ userId: premiumGrants.userId, status: premiumGrants.status, productId: premiumGrants.productId })
    .from(premiumGrants)
    .where(eq(premiumGrants.source, 'household'));
  return { cover, existing };
}

/**
 * Bring every household grant in line with who a household's Premium covers now (the rule is
 * decideHouseholdCover). One grant per covered person, keyed by them, naming whose Premium covers
 * them in productId. Run after anything that changes someone's own Premium or a household's
 * members, and hourly by the reconcile-store-premium cron in case one of those was missed.
 */
export async function reconcileHouseholdCover(correlationId: CorrelationId): Promise<{ covered: number; changed: number }> {
  const { cover, existing } = await householdCoverPlan();
  const current = new Map(existing.map((grant) => [grant.userId, grant]));

  let changed = 0;
  for (const [memberId, payerId] of cover) {
    const grant = current.get(memberId);
    if (grant?.status === 'active' && grant.productId === payerId) continue;
    await upsertGrant({ userId: memberId, source: 'household', externalId: memberId, status: 'active', productId: payerId, note: 'Covered by a household member\'s Premium' });
    await recomputeSubscribed(memberId, correlationId, { cascade: false });
    changed++;
  }
  for (const grant of existing) {
    if (grant.status !== 'active' || cover.has(grant.userId)) continue;
    await db
      .update(premiumGrants)
      .set({ status: 'none', updatedAt: new Date() })
      .where(and(eq(premiumGrants.source, 'household'), eq(premiumGrants.externalId, grant.userId)));
    await recomputeSubscribed(grant.userId, correlationId, { cascade: false });
    changed++;
  }
  if (changed > 0) {
    submitLogEvent('subscription', `Household cover changed for ${changed} ${changed === 1 ? 'person' : 'people'}`, correlationId, { covered: cover.size, changed });
  }
  return { covered: cover.size, changed };
}

/**
 * reconcileHouseholdCover for the paths where it's a side effect (a household's members changed,
 * someone's Premium changed): a failure is logged and alerted, never thrown, because the hourly
 * reconcile puts it right and the change the person asked for has already happened.
 */
export async function refreshHouseholdCover(correlationId: CorrelationId = randomUUID() as CorrelationId): Promise<void> {
  try {
    await reconcileHouseholdCover(correlationId);
  } catch (error) {
    submitLogEvent('subscription', `Household cover refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
  }
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
