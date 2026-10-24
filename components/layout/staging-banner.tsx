'use client';

import { AlertTriangle } from 'lucide-react';

export function StagingBanner() {
  if (process.env.NEXT_PUBLIC_IS_STAGING !== 'true') {
    return null;
  }

  return (
    /* Was hardcoded amber-500/amber-950 with a warning triangle on each side of
       the text, bookend-style. One icon is enough to mean "warning". Not sticky:
       the navigation is sticky at top-0 too, and covered it once the page scrolled. */
    <div className="bg-warning px-4 py-2 text-center text-sm font-semibold text-warning-foreground">
      <div className="flex items-center justify-center gap-2">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        <span>Staging &mdash; not production. Data here is disposable.</span>
      </div>
    </div>
  );
}
