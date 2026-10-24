/**
 * Whether the email/password sign-in for testing is on.
 *
 * Its own module with no imports, so the sign-in page can read it without pulling in better-auth and
 * the database. Production signs in with Google only; this exists so local and automated testing
 * produce a real Better Auth session without depending on Google OAuth (the same approach as Squint).
 *
 * Two guards: RECEIPTWISE_DEV_LOGIN=1 must be set, and on Vercel it is refused everywhere except the
 * staging branch's preview, whatever the opt-in says. Staging is also behind Vercel Authentication,
 * and uses the shared preview database, not production's.
 */
export function isDevLoginEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.RECEIPTWISE_DEV_LOGIN !== '1') return false;
  if (!env.VERCEL) return true;
  return env.VERCEL_ENV === 'preview' && env.VERCEL_GIT_COMMIT_REF === 'staging';
}

/**
 * Password accounts can only use this domain. `.test` is reserved (RFC 2606), so nobody receives
 * mail there: a password account can never carry a real person's address, and so can never be
 * linked to their account by email. Google accounts are unaffected.
 */
export const TEST_EMAIL_DOMAIN = 'receiptwise.test';

export function isTestEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.trim().toLowerCase().endsWith(`@${TEST_EMAIL_DOMAIN}`));
}

/** Whether Google sign-in can work: without credentials better-auth throws on click. */
export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
