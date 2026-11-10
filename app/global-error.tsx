'use client';

import { useEffect } from 'react';
import './globals.css';
import { reportWebError } from '@/lib/report-web-error';

/**
 * The root layout itself crashed, so this replaces it, <html> and all, and nothing from the layout
 * (providers, theme, navigation) can be used. Plain markup, a retry and a way to reach us.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportWebError(error), [error]);

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <main className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-12" aria-labelledby="error-title">
          <div>
            <h1 id="error-title" className="text-3xl font-semibold tracking-tight">ReceiptWise didn&apos;t load</h1>
            <p className="mt-4 text-muted-foreground">
              Something went wrong on our side, and we&apos;ve been told. Try again in a moment. If it keeps happening, email{' '}
              <a href="mailto:support@receiptwise.io" className="underline">support@receiptwise.io</a>.
            </p>
            <button type="button" onClick={reset} className="mt-8 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
