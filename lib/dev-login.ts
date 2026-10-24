/**
 * Whether the development-only email/password sign-in is on.
 *
 * Its own module with no imports, so the sign-in page can read it without pulling in better-auth and
 * the database. Production signs in with Google only; this exists so local and automated testing
 * produce a real Better Auth session without depending on Google OAuth (the same approach as Squint).
 *
 * Two guards: RECEIPTWISE_DEV_LOGIN=1 must be set (it is absent from Vercel), and it is refused on
 * any Vercel deployment, production or preview, whatever the opt-in says.
 */
export function isDevLoginEnabled(): boolean {
  if (process.env.RECEIPTWISE_DEV_LOGIN !== '1') return false;
  if (process.env.VERCEL) return false;
  return true;
}

/** Whether Google sign-in can work: without credentials better-auth throws on click. */
export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
