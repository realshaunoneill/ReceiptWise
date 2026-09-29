import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Minus } from 'lucide-react';

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
const features = [
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
    description: 'Share a receipt pile with family, a partner or flatmates.',
    free: null,
    premium: 'Unlimited',
  },
  {
    title: 'Insights',
    description: 'Category breakdowns, spending trends and item history.',
    free: 'Read existing data',
    premium: 'Full access',
  },
  {
    title: 'Subscriptions',
    description: 'Track recurring payments and see what is due next.',
    free: 'Read existing data',
    premium: 'Full access',
  },
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

export function ComparisonTable() {
  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-foreground">
          What changes when you subscribe
        </CardTitle>
        <CardDescription className="text-base">
          Without a subscription the app is read-only: nothing you have added is taken away,
          but nothing new can be added.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="-mx-2 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[480px] text-left">
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
                    {feature.free ?? (
                      <>
                        <Minus className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
                        <span className="sr-only">Not included</span>
                      </>
                    )}
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
