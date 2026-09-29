import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/landing-page';

// The landing page itself is a client component (it switches CTAs on Clerk's sign-in state), and
// a client page cannot export metadata. This server wrapper exists so '/' can declare its own
// canonical instead of the root layout declaring '/' as canonical for every page in the app.
export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
};

export default function Home() {
  return <LandingPage />;
}
