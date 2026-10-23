import { type User } from '@/lib/db/schema';

/**
 * Server-side feature flags, for work that merges to master (which deploys to production)
 * before it is ready for everyone.
 *
 * A flag `x` is read from FEATURE_X:
 *   - "all"  → on for everyone (Preview runs with this)
 *   - unset  → on only for admins (users.is_admin, set by scripts/set-admin.ts) and for the
 *              comma-separated emails in FEATURE_X_ALLOWLIST
 *   - "off"  → off for everyone, admins included
 *
 * Not PostHog flags: posthog-js only loads after analytics consent, so a user who declined
 * would never see the feature.
 */

export const FEATURES = ['bills'] as const;
export type Feature = typeof FEATURES[number];
export type FeatureFlags = Record<Feature, boolean>;

function envName(feature: Feature): string {
  return `FEATURE_${feature.toUpperCase()}`;
}

export function isFeatureEnabled(user: Pick<User, 'email' | 'isAdmin'>, feature: Feature): boolean {
  const mode = process.env[envName(feature)]?.trim().toLowerCase();
  if (mode === 'all') return true;
  if (mode === 'off') return false;
  if (user.isAdmin) return true;

  const allowlist = (process.env[`${envName(feature)}_ALLOWLIST`] ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(user.email.toLowerCase());
}

export function featureFlagsFor(user: Pick<User, 'email' | 'isAdmin'>): FeatureFlags {
  return Object.fromEntries(FEATURES.map((feature) => [feature, isFeatureEnabled(user, feature)])) as FeatureFlags;
}
