/** GET /api/users/me: the signed-in account, what it may use, and its settings. */
export type WireMe = {
  id: string;
  email: string;
  /** Premium of its own, from any source (premium_grants). */
  subscribed: boolean;
  isAdmin: boolean;
  isBlocked: boolean;
  currency: string;
  defaultHouseholdId: string | null;
  onboardingCompletedAt: string | null;
  /** Set while a deletion is scheduled (it happens 24 hours after asking); cancellable till then. */
  deletionScheduledAt: string | null;
  stripeCustomerId: string | null;
  createdAt: string;
  features: { bills: boolean };
  /** Finance features: their own Premium, or households another member's Premium covers. */
  entitlements: { personal: boolean; householdIds: string[] };
};
