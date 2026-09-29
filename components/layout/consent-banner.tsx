'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  getConsent,
  isAnalyticsConfigured,
  OPEN_CONSENT_EVENT,
  setConsent,
  type ConsentChoice,
} from '@/lib/analytics/consent';

/**
 * Asks before any analytics run. Nothing non-essential loads until "Accept"; "Decline" is the
 * same size and weight, because a consent choice nudged one way is not freely given.
 */
export function ConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isAnalyticsConfigured) return;
    if (getConsent() === null) setOpen(true);

    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  if (!open) return null;

  const choose = (choice: ConsentChoice) => {
    setConsent(choice);
    setOpen(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      // Bottom-right and compact so it does not sit over the hero's call to action.
      className="fixed inset-x-4 bottom-4 z-50 rounded-lg border bg-card p-4 text-card-foreground shadow-lg sm:inset-x-auto sm:right-6 sm:max-w-sm"
    >
      <p className="text-sm text-muted-foreground">
        May we use analytics to see where the app gets in people&apos;s way? Session recordings hide
        everything you type and every amount. Nothing runs unless you accept.{' '}
        <Link href="/privacy#cookies" className="text-primary underline underline-offset-4">
          Details
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => choose('denied')}>
          Decline
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={() => choose('granted')}>
          Accept
        </Button>
      </div>
    </div>
  );
}

/** Footer link that reopens the banner so a choice can be changed later. */
export function CookieSettingsButton({ className }: { className?: string }) {
  if (!isAnalyticsConfigured) return null;

  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CONSENT_EVENT))}
    >
      Cookie settings
    </button>
  );
}
