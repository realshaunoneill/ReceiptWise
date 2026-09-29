'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import posthog from 'posthog-js';
import { CONSENT_CHANGE_EVENT, hasAnalyticsConsent, isAnalyticsConfigured } from '@/lib/analytics/consent';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { user, isSignedIn, isLoaded } = useUser();
  const [consented, setConsented] = useState(false);
  const wasSignedIn = useRef<boolean | null>(null);

  useEffect(() => {
    if (!isAnalyticsConfigured) return;
    setConsented(hasAnalyticsConsent());
    const onChange = () => setConsented(hasAnalyticsConsent());
    window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
  }, []);

  useEffect(() => {
    // Wait for Clerk: while it loads, isSignedIn is undefined, and treating that as "signed out"
    // called posthog.reset() on every page load — a fresh anonymous id per visit, which broke
    // landing → signup attribution.
    if (!isAnalyticsConfigured || !consented || !isLoaded || !posthog.__loaded) return;

    if (isSignedIn && user) {
      // Email is kept as a person property (disclosed in the privacy policy); name is not sent.
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        createdAt: user.createdAt,
      });
    } else if (wasSignedIn.current) {
      // Only on a genuine signed-in → signed-out transition.
      posthog.reset();
    }

    wasSignedIn.current = !!isSignedIn;
  }, [consented, isLoaded, isSignedIn, user]);

  return <>{children}</>;
}
