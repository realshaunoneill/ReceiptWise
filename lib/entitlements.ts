/**
 * Who has Premium, decided from every place it can come from (premium_grants): a Stripe
 * subscription on the website, an App Store or Google Play subscription bought in the app,
 * Premium given by hand, or someone else's Premium in a household you share. Pure, so the rules
 * are tested on their own; the database side is lib/services/entitlement-service.ts, the only
 * writer of users.subscribed.
 */

export const GRANT_SOURCES = ['stripe', 'app_store', 'play_store', 'comp', 'household'] as const;
export type GrantSource = (typeof GRANT_SOURCES)[number];

/**
 * Premium a person has of their own: paid for, or given by hand. Only this covers a household.
 * 'household' is Premium through someone else's, so it never passes on: being covered in one
 * household can't cover the people in another.
 */
export const OWN_SOURCES = ['stripe', 'app_store', 'play_store', 'comp'] as const;

export const GRANT_STATUSES = ['active', 'trialing', 'grace', 'billing_issue', 'cancelled', 'expired', 'refunded', 'none'] as const;
export type GrantStatus = (typeof GRANT_STATUSES)[number];

/**
 * The statuses that give Premium. A payment that failed and is being retried still does, as
 * Stripe's past_due always has here: the subscription isn't over until the retries are.
 */
export const ENTITLED_STATUSES: readonly GrantStatus[] = ['active', 'trialing', 'grace', 'billing_issue'];

export type GrantLike = {
  source: string;
  status: string;
  expiresAt: Date | null;
};

/** Whether this one grant gives Premium at `now`. */
export function isLiveGrant(grant: GrantLike, now: Date): boolean {
  if (!(ENTITLED_STATUSES as readonly string[]).includes(grant.status)) return false;
  return grant.expiresAt === null || grant.expiresAt.getTime() > now.getTime();
}

/** Premium if any grant gives it, and the one that does (the first live one by source order). */
export function decidePremium<T extends GrantLike>(grants: readonly T[], now: Date): { premium: boolean; grant: T | null } {
  const live = grants
    .filter((grant) => isLiveGrant(grant, now))
    .sort((a, b) => sourceRank(a.source) - sourceRank(b.source));
  return { premium: live.length > 0, grant: live[0] ?? null };
}

/**
 * A paid source before a comp grant, and both before a household's, so Settings says how someone
 * is billed: their own Premium first, then Premium through someone else's.
 */
function sourceRank(source: string): number {
  const index = (GRANT_SOURCES as readonly string[]).indexOf(source);
  return index === -1 ? GRANT_SOURCES.length : index;
}

/**
 * How many people one Premium covers besides its owner: six in all, as Apple's Family Sharing. A
 * limit, so a household can't be used to hand Premium out to anyone who joins it.
 */
export const HOUSEHOLD_COVER_LIMIT = 5;

/** Someone with Premium of their own, and someone without who shares a household with them. */
export type CoverPair = { payerId: string; memberId: string; joinedAt: Date };

/**
 * Who a household's Premium covers. Each person with Premium of their own covers the people they
 * share a household with who have none, up to HOUSEHOLD_COVER_LIMIT of them across all their
 * households, earliest to join first, so someone who joins later never pushes out someone already
 * covered. Someone another Premium already covers doesn't use up a place. Returns each covered
 * person and whose Premium covers them (the first payer, by id, when two could). `pairs` holds
 * only people without Premium of their own as members.
 */
export function decideHouseholdCover(pairs: readonly CoverPair[], limit = HOUSEHOLD_COVER_LIMIT): Map<string, string> {
  const byPayer = new Map<string, CoverPair[]>();
  for (const pair of pairs) {
    if (pair.payerId === pair.memberId) continue;
    const list = byPayer.get(pair.payerId) ?? [];
    list.push(pair);
    byPayer.set(pair.payerId, list);
  }
  const covered = new Map<string, string>();
  for (const payerId of [...byPayer.keys()].sort()) {
    // The same person can share several households with one payer: they count once, from the
    // first time they joined one.
    const firstJoin = new Map<string, number>();
    for (const pair of byPayer.get(payerId)!) {
      const at = pair.joinedAt.getTime();
      if (!firstJoin.has(pair.memberId) || at < firstJoin.get(pair.memberId)!) firstJoin.set(pair.memberId, at);
    }
    // Someone another Premium already covers doesn't use up a place in this one.
    let places = limit;
    for (const [memberId] of [...firstJoin.entries()].sort(([a, at], [b, bt]) => at - bt || a.localeCompare(b))) {
      if (places === 0) break;
      if (covered.has(memberId)) continue;
      covered.set(memberId, payerId);
      places--;
    }
  }
  return covered;
}

/**
 * A Stripe subscription status as a grant status. Only active, trialing and past_due give
 * Premium, as before grants existed (lib/stripe.ts ENTITLED_STATUSES).
 */
export function stripeGrantStatus(status: string | null | undefined): GrantStatus {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'billing_issue';
    case 'canceled':
      return 'cancelled';
    case 'incomplete_expired':
    case 'unpaid':
      return 'expired';
    case 'incomplete':
    case 'paused':
      return 'none';
    default:
      return 'none';
  }
}
