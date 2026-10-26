/**
 * Who has Premium, decided from every place it can come from (premium_grants): a Stripe
 * subscription on the website, an App Store or Google Play subscription bought in the app, or
 * Premium given by hand. Pure, so the rules are tested on their own; the database side is
 * lib/services/entitlement-service.ts, the only writer of users.subscribed.
 */

export const GRANT_SOURCES = ['stripe', 'app_store', 'play_store', 'comp'] as const;
export type GrantSource = (typeof GRANT_SOURCES)[number];

export const GRANT_STATUSES = ['active', 'trialing', 'grace', 'billing_issue', 'cancelled', 'expired', 'refunded', 'none'] as const;
export type GrantStatus = (typeof GRANT_STATUSES)[number];

/**
 * The statuses that give Premium. A payment that failed and is being retried still does, as
 * Stripe's past_due always has here: the subscription isn't over until the retries are.
 */
const ENTITLED: readonly GrantStatus[] = ['active', 'trialing', 'grace', 'billing_issue'];

export type GrantLike = {
  source: string;
  status: string;
  expiresAt: Date | null;
};

/** Whether this one grant gives Premium at `now`. */
export function isLiveGrant(grant: GrantLike, now: Date): boolean {
  if (!(ENTITLED as readonly string[]).includes(grant.status)) return false;
  return grant.expiresAt === null || grant.expiresAt.getTime() > now.getTime();
}

/** Premium if any grant gives it, and the one that does (the first live one by source order). */
export function decidePremium<T extends GrantLike>(grants: readonly T[], now: Date): { premium: boolean; grant: T | null } {
  const live = grants
    .filter((grant) => isLiveGrant(grant, now))
    .sort((a, b) => sourceRank(a.source) - sourceRank(b.source));
  return { premium: live.length > 0, grant: live[0] ?? null };
}

/** A paid source before a comp grant, so Settings says how someone is billed. */
function sourceRank(source: string): number {
  const index = (GRANT_SOURCES as readonly string[]).indexOf(source);
  return source === 'comp' ? GRANT_SOURCES.length : index === -1 ? GRANT_SOURCES.length + 1 : index;
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
