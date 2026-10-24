import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { LandingPage } from '@/components/landing/landing-page';
import { getAuth } from '@/lib/auth';

// The landing page itself is a client component (it switches CTAs on the sign-in state), and
// a client page cannot export metadata. This server wrapper exists so '/' can declare its own
// canonical instead of the root layout declaring '/' as canonical for every page in the app.
export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

export default async function Home() {
  // Read here so the first HTML has the right calls to action. A signed-out visitor has no cookie,
  // so this costs nothing; a signed-in one is served from the 5-minute session cookie cache.
  // headers() first: it marks the page dynamic before the auth instance is built, so `next build`
  // never constructs better-auth (which, without a secret at build time, logs an error).
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders }).catch(() => null);
  return <LandingPage initialSignedIn={Boolean(session)} />;
}
