'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, Home, Receipt, Settings, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navigation } from '@/components/layout/navigation';

/**
 * 404.
 *
 * This page was three cards, twelve links and two support call-to-actions: a
 * "Quick Actions" card, a "Need Help?" card listing every route in the app, and a
 * third "Still Need Help?" card offering both a support page and a mailto, all
 * over blurred gradient blobs. Someone who mistyped a URL does not need a support
 * escalation path — a wrong link is not an incident. It is one sentence, a way
 * back, and the four places they were probably heading.
 */

const destinations = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/receipts', label: 'Receipts', icon: Receipt },
  { href: '/insights', label: 'Insights', icon: TrendingUp },
  { href: '/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function NotFound() {
  const router = useRouter();

  return (
    <>
      <Navigation />
      <main
        className="container mx-auto flex min-h-[calc(100vh-14rem)] max-w-2xl items-center px-4 py-12"
        aria-labelledby="error-title"
      >
        <div className="w-full">
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-muted-foreground">
            Error 404
          </p>
          <h1
            id="error-title"
            className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            That page isn&apos;t here
          </h1>
          <p className="mt-4 text-muted-foreground">
            The link may be out of date, or the address may have a typo in it. Nothing has
            happened to your receipts.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={() => router.back()} variant="default" className="gap-2">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Go back
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>

          <div className="mt-12 border-t pt-6">
            <p className="text-sm font-medium text-foreground">Or jump to</p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {destinations.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">
              Think this is a broken link on our side?{' '}
              <Link href="/support" className="text-primary underline underline-offset-4">
                Tell us
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
