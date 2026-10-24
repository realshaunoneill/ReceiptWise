'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Minus } from 'lucide-react';
import { useFeature } from '@/lib/hooks/use-user';
import { BILLS_LAUNCHED } from '@/lib/public-features';

/**
 * The single feature list on the upgrade page.
 *
 * There were two. `FeaturesGrid` rendered these same eight titles as eight cards
 * with descriptions, and this table rendered the same eight titles again as rows,
 * one directly below the other on the same page — so anyone scrolling read the
 * feature set twice and could reasonably wonder what the difference was. The
 * descriptions have moved in here and the grid is gone.
 *
 * "Priority Support" previously listed the free column as "Community support".
 * There is no community — no forum, no Discord, nothing — so that row promised a
 * support channel that does not exist. It says what free users actually get.
 *
 * The first column was headed "Free", which read as a free plan. There is no free plan —
 * one paid plan with a trial — so it describes an account without a subscription.
 */
type Feature = { title: string; description: string; free: string | null; premium: string };

/** `bills`: the account has the bills feature (or it has launched), so the plan rows apply. */
function featuresFor(bills: boolean): Feature[] {
  return [
  {
    title: 'Receipts',
    description: 'Photograph or upload a receipt and have it read for you.',
    free: 'Read what you already added',
    premium: 'Unlimited',
  },
  {
    title: 'Scanning',
    description: 'Merchant, date, total, tax and every line item extracted automatically.',
    free: null,
    premium: 'Every receipt',
  },
  {
    title: 'Households',
    description: 'Share a receipt pile with family, a partner or housemates.',
    // Joining one you're invited to is free; it said "not included", to people already in one.
    free: 'Join one you are invited to',
    premium: 'Create your own, unlimited',
  },
  {
    title: 'Insights',
    description: 'Category breakdowns, spending trends and item history.',
    free: 'Read existing data',
    premium: 'Full access',
  },
  {
    title: bills ? 'Bills & subscriptions' : 'Subscriptions',
    description: bills
      ? 'Every bill and subscription, and what is due next.'
      : 'Track recurring payments and see what is due next.',
    free: bills ? 'Shared ones, in a household another member pays for' : 'Read existing data',
    premium: 'Full access',
  },
  ...(bills ? [{
    title: 'Monthly plan',
    description: 'Pay, bills and savings payday to payday, with bills read from uploads or forwarded email.',
    free: 'A household\'s plan, if another member pays',
    premium: 'Full access',
  }] : []),
  {
    title: 'Export',
    description: 'Take everything out as CSV, JSON, or HTML with the images.',
    // Export is not gated, and should not be: taking your data out is a right (GDPR Art. 20).
    free: 'Any time',
    premium: 'Any time',
  },
  {
    title: 'Chrome extension',
    description: 'Clip online receipts that never get printed. Coming to the Chrome Web Store.',
    free: null,
    premium: 'When it launches',
  },
  {
    title: 'Support',
    description: 'Email us and a person reads it.',
    free: 'Email support',
    premium: 'Email support',
  },
  ];
}

function Included({ value }: { value: string | null }) {
  return value ?? (
    <>
      <Minus className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
      <span className="sr-only">Not included</span>
    </>
  );
}

export function ComparisonTable() {
  // The account's own flag, not only the public launch switch: people who already have the plan
  // and bills in their navigation weren't told they're part of Premium.
  const billsEnabled = useFeature('bills');
  const features = featuresFor(billsEnabled || BILLS_LAUNCHED);
  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-foreground">
          What changes when you subscribe
        </CardTitle>
        <CardDescription className="text-base">
          Without a subscription, nothing you have added is taken away, but nothing new can be
          added, apart from what a household you&apos;re in shares with you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* On a phone, one block per feature: the table scrolled sideways there, with the
            Premium column off the screen. */}
        <dl className="divide-y sm:hidden">
          {features.map((feature) => (
            <div key={feature.title} className="py-4 first:pt-0">
              <dt className="font-medium text-foreground">{feature.title}</dt>
              <dd className="mt-0.5 text-sm text-muted-foreground">{feature.description}</dd>
              <dd className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <span className="text-muted-foreground">Without</span>
                <span className="text-muted-foreground"><Included value={feature.free} /></span>
                <span className="font-semibold text-primary">Premium</span>
                <span className="flex items-start gap-1.5 text-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  {feature.premium}
                </span>
              </dd>
            </div>
          ))}
        </dl>
        <div className="hidden sm:block">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b">
                <th scope="col" className="py-3 pr-4 text-sm font-semibold text-foreground">
                  Feature
                </th>
                <th scope="col" className="px-4 py-3 text-sm font-medium text-muted-foreground">
                  Without Premium
                </th>
                <th scope="col" className="px-4 py-3 text-sm font-semibold text-primary">
                  Premium
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature) => (
                <tr key={feature.title} className="border-b align-top last:border-0">
                  <th scope="row" className="max-w-64 py-4 pr-4 font-normal">
                    <span className="font-medium text-foreground">{feature.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {feature.description}
                    </span>
                  </th>
                  <td className="px-4 py-4 text-sm text-muted-foreground">
                    <Included value={feature.free} />
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <span className="flex items-start gap-1.5 text-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      {feature.premium}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
