/**
 * Build-time switch for public copy about the monthly plan and bills: the landing page, pricing,
 * upsell lists. Off until launch, so nothing advertises a feature only some accounts have.
 *
 * At launch: FEATURE_BILLS=all (lib/features.ts) and NEXT_PUBLIC_BILLS_LAUNCHED=true, then redeploy
 * (NEXT_PUBLIC_ values are baked into the build).
 */
export const BILLS_LAUNCHED = process.env.NEXT_PUBLIC_BILLS_LAUNCHED === 'true';
