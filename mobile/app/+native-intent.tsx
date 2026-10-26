import { routeForLink } from '../src/links';

/**
 * Filters and maps the deep links the router acts on.
 *
 * Google sign-in finishes on receiptwise:///?cookie=…, which belongs to
 * openAuthSessionAsync in src/auth/auth.ts. On Android the Custom Tab also hands
 * that link to the router as an ordinary deep link, and following it would
 * navigate away from the screen signing in. While the app is running,
 * that link is ignored here; the auth session still receives it.
 *
 * Every other link is mapped from the website's pages to the app's routes
 * (src/links.ts): /invite/<token>, /receipts?selected=<id>, /plan, /dashboard,
 * /subscriptions. One it doesn't know goes through as it is.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  if (path.includes('cookie=')) {
    return initial ? path : null;
  }

  return routeForLink(path) ?? path;
}
