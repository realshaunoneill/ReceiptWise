'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import posthog from 'posthog-js';
import { CONSENT_CHANGE_EVENT, hasAnalyticsConsent, isAnalyticsConfigured } from '@/lib/analytics/consent';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const user = session?.user;
  const isSignedIn = Boolean(user);
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
    // Wait for the session: treating "still loading" as "signed out" called posthog.reset() on
    // every page load — a fresh anonymous id per visit, which broke landing → signup attribution.
    if (!isAnalyticsConfigured || !consented || isPending || !posthog.__loaded) return;

    if (isSignedIn && user) {
      // The auth user id, which the server's receipt_uploaded event uses too. Email is kept as a
      // person property (disclosed in the privacy policy); name is not sent.
      posthog.identify(user.id, {
        email: user.email,
        createdAt: user.createdAt,
      });
    } else if (wasSignedIn.current) {
      // Only on a genuine signed-in → signed-out transition.
      posthog.reset();
    }

    wasSignedIn.current = isSignedIn;
  }, [consented, isPending, isSignedIn, user]);

  return <>{children}</>;
}
