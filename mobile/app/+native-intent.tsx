/**
 * Filters the deep links the router acts on.
 *
 * Google sign-in finishes on receiptwise:///?cookie=…, which belongs to
 * openAuthSessionAsync in src/auth/auth.ts. On Android the Custom Tab also hands
 * that link to the router as an ordinary deep link, and following it would
 * navigate away from the screen signing in. While the app is running,
 * that link is ignored here; the auth session still receives it.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  if (!initial && path.includes('cookie=')) {
    return null;
  }

  return path;
}
