import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Sends signed-out visitors on app pages to /sign-in. A cookie check only.
 *
 * A session cookie here is not proof of a valid session: every API route resolves the real
 * session itself (getAuthenticatedUser / guardFinanceRoute), and the protected layout does too.
 * This only decides whether to bother rendering a page.
 *
 * It doesn't touch /api at all. API routes answer a JSON 401 themselves, and several must be
 * reachable without a session: /api/auth (the Google callback), webhooks (Stripe, inbound email),
 * crons, the extension's API-key routes and /api/pricing. Excluding the API surface makes "gated
 * the callback by mistake" impossible rather than something an allowlist has to remember (the
 * pattern from Squint, after AutoToonify's Blob callback was blocked this way).
 */

const PUBLIC_PAGES = [
  /^\/$/,
  /^\/sign-in(\/.*)?$/,
  /^\/sign-up(\/.*)?$/,
  /^\/invite(\/.*)?$/, // invitation links: shows who invited you, then routes through sign-in
  /^\/(support|terms|privacy|refund)$/,
  /^\/(opengraph|twitter)-image(\/.*)?$/,
  /^\/(sitemap\.xml|robots\.txt|manifest\.json)$/,
  /^\/ingest(\/.*)?$/, // PostHog
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PAGES.some((pattern) => pattern.test(pathname))) return NextResponse.next();

  // better-auth's helper rather than a hardcoded cookie name: it handles the __Secure- prefix.
  if (!getSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = '';
    url.searchParams.set('redirect_url', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Page routes only: no /api, no Next internals, no static files.
  matcher: [
    '/((?!api|_next/static|_next/image|.*\\.(?:png|jpe?g|gif|svg|ico|webp|avif|webmanifest|json|xml|txt|woff2?|map|css|js)$).*)',
  ],
};
