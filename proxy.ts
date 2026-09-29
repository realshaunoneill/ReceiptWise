import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/invite(.*)', // Invitation links: shows who invited you, then routes through sign-in
  '/',
  '/support',
  '/terms',
  '/privacy',
  '/refund',
  '/sitemap.xml',
  '/robots.txt',
  '/favicon.ico',
  '/icon.svg',
  '/apple-icon.png',
  '/manifest.json',
  '/opengraph-image(.*)',
  '/twitter-image(.*)',
  // Public so the landing page can quote the live Stripe price rather than a
  // hardcoded one. The route is force-static, cached for an hour and returns
  // only product/price fields — no user or account data.
  '/api/pricing',
  '/api/webhooks(.*)',
  '/api/stripe/webhooks', // Stripe webhooks
  '/api/extension(.*)', // Chrome extension API (uses API key auth)
  '/api/cron(.*)', // Vercel Cron (authenticates with CRON_SECRET bearer token)
  '/ingest(.*)', // PostHog analytics
]);

const isApiRoute = createRouteMatcher(['/api(.*)', '/trpc(.*)']);

export default clerkMiddleware(
  async (auth, request) => {
    if (isPublicRoute(request)) return;

    // API callers get a JSON 401. auth.protect() would redirect them to the sign-in page, and a
    // client fetch() that follows it gets HTML where it expects JSON.
    if (isApiRoute(request)) {
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return;
    }

    await auth.protect();
  },
  {
    // Without these, auth.protect() sends signed-out visitors to Clerk's hosted
    // accounts.receiptwise.io pages rather than the app's own /sign-in.
    signInUrl: '/sign-in',
    signUpUrl: '/sign-up',
  },
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
