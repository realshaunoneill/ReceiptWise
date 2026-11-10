'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { reportWebError } from '@/lib/report-web-error';

/**
 * A page that crashed while rendering. Without this, Next showed its bare "Application error"
 * screen with no way back. The crash is reported (lib/report-web-error.ts), and the layout around
 * it, the navigation included, stays.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportWebError(error), [error]);

  return (
    <main className="container mx-auto flex min-h-[calc(100vh-14rem)] max-w-2xl items-center px-4 py-12" aria-labelledby="error-title">
      <div className="w-full">
        <p className="font-mono text-sm uppercase tracking-[0.18em] text-muted-foreground">Something went wrong</p>
        <h1 id="error-title" className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          This page didn&apos;t load
        </h1>
        <p className="mt-4 text-muted-foreground">
          We&apos;ve been told about it. Try again, and if it keeps happening, email{' '}
          <a href="mailto:support@receiptwise.io" className="text-primary hover:underline">support@receiptwise.io</a>.
          Your receipts, bills and plan are safe.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild><Link href="/">Home</Link></Button>
        </div>
      </div>
    </main>
  );
}
