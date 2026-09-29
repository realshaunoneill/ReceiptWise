'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Pricing panel for the public landing page.
 *
 * The prices here used to be typed into the markup: "€4.99/month", "€39.99/year
 * (save 33%)". The upgrade page, meanwhile, reads the live figures from Stripe,
 * and the onboarding tour carried a third hardcoded pair (€1.66 / €19.99, "17%
 * off"). Three sets of numbers for one subscription, any of which could be the
 * one that stops matching checkout. This reads the same Stripe-backed endpoint
 * the upgrade page uses, and the saving is computed rather than asserted.
 */

interface Price {
  amount: number;
  currency: string;
  interval: string;
}

interface Pricing {
  monthly: Price;
  annual: Price | null;
}

const INCLUDED = [
  'Unlimited receipts',
  'Automatic scanning of every receipt',
  'Unlimited households',
  'Spending analytics and insights',
  'Subscription tracking',
  'CSV and JSON export',
  // Not yet on the Chrome Web Store, so it is named as coming rather than as included. "Priority
  // support" was also here: with one plan there is no lower tier to be prioritised over.
  'Chrome extension, once it is on the Chrome Web Store',
];

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

export function LandingPricing({ isSignedIn }: { isSignedIn: boolean }) {
  const { data: pricing, isLoading } = useQuery<Pricing>({
    queryKey: ['pricing'],
    queryFn: async () => {
      const response = await fetch('/api/pricing');
      if (!response.ok) throw new Error('Failed to fetch pricing');
      return response.json();
    },
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  const trialDays = process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS
    ? parseInt(process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS)
    : 0;

  const monthly = pricing?.monthly;
  const annual = pricing?.annual;
  const annualSaving =
    monthly && annual
      ? Math.round(((monthly.amount * 12 - annual.amount) / (monthly.amount * 12)) * 100)
      : null;

  return (
    <Card className="relative mx-auto max-w-md overflow-hidden border-primary/40 shadow-sm">
      {/* A receipt has a torn top edge. One repeating-gradient, no images. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1.5 bg-[repeating-linear-gradient(90deg,var(--primary)_0_6px,transparent_6px_12px)] opacity-60"
      />
      <CardContent className="p-8">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-lg font-semibold text-foreground">Premium</h3>
          {trialDays > 0 && (
            <span className="font-mono text-xs uppercase tracking-[0.14em] text-primary">
              {trialDays}-day trial
            </span>
          )}
        </div>

        <div className="mt-6 min-h-20">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-11 w-32" />
              <Skeleton className="h-4 w-44" />
            </div>
          ) : monthly ? (
            <>
              <p className="flex items-baseline gap-1.5">
                <span className="amount text-4xl font-semibold tracking-tight text-foreground">
                  {formatPrice(monthly.amount, monthly.currency)}
                </span>
                <span className="text-muted-foreground">per month</span>
              </p>
              {annual && (
                <p className="mt-2 text-sm text-muted-foreground">
                  or{' '}
                  <span className="amount font-medium text-foreground">
                    {formatPrice(annual.amount, annual.currency)}
                  </span>{' '}
                  a year
                  {annualSaving && annualSaving > 0 && `, saving ${annualSaving}%`}
                </p>
              )}
            </>
          ) : (
            // No invented figure if Stripe is unreachable — send them to the page
            // that can quote it properly.
            <p className="text-sm text-muted-foreground">
              One subscription, billed monthly or annually. Current pricing is shown at
              checkout.
            </p>
          )}
        </div>

        <ul className="mt-8 space-y-2.5">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>

        <Button asChild className="mt-8 w-full gap-2">
          <Link href={isSignedIn ? '/upgrade' : '/sign-up'}>
            {trialDays > 0 ? `Start your ${trialDays}-day trial` : 'Subscribe'}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {trialDays > 0
            ? 'Card details are needed to begin. Cancel during the trial and nothing is charged.'
            : 'Cancel any time.'}
        </p>
      </CardContent>
    </Card>
  );
}
