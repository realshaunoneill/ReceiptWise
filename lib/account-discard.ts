/**
 * Discarding an account that was made by mistake: someone signs in to the app with Apple's "Hide my
 * email", which gives an address no existing account has, so they get a new empty account instead of
 * the one they already use with Google. The app asks "new, or already have one?", and "already have
 * one" discards the new account before signing in with Google. Pure, so the rule is tested; the route
 * is app/api/users/me/discard.
 *
 * Only an account nothing could be lost from: under a day old, one sign-in method, no Stripe
 * customer, no Premium of any kind, and nothing made in it.
 */

export const DISCARD_WINDOW_MS = 24 * 60 * 60 * 1000;

export type DiscardFacts = {
  createdAt: Date;
  stripeCustomerId: string | null;
  signInMethods: number;
  /** Rows the account owns anywhere (receipts, bills, plan, households, grants, keys...). */
  ownedRows: number;
};

/** Why the account can't be discarded, or null if it can. */
export function discardRefusal(facts: DiscardFacts, now: Date): string | null {
  if (now.getTime() - facts.createdAt.getTime() > DISCARD_WINDOW_MS) return 'Only an account made today can be discarded.';
  if (facts.stripeCustomerId) return 'This account has billing history.';
  if (facts.signInMethods !== 1) return 'This account has more than one way to sign in.';
  if (facts.ownedRows > 0) return 'This account already has things in it.';
  return null;
}
