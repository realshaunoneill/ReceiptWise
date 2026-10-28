'use client';

import { Calendar, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { type Subscription } from '@/lib/db/schema';
import { useCurrency } from '@/lib/hooks/use-currency';
import { useFeature } from '@/lib/hooks/use-user';
import { daysBetween, fromUtcDate, localToday } from '@/lib/dates/local-date';
import { frequencyLabel } from '@/lib/schedule/billing-schedule';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/currency';
import { formatTotals, totalsByCurrency } from '@/lib/utils/currency-totals';
import { nextPaymentAmount, nextPaymentLabel } from '@/shared/labels/subscriptions';

/** What the list gives each row: GET /api/subscriptions adds the next cycle's own amount. */
type UpcomingSubscription = Subscription & { nextAmount?: string | null };

/** Days from today to a subscription's next billing day (stored as midnight UTC of that day). */
function daysUntilBilling(subscription: Subscription, today: string): number {
  return daysBetween(today, fromUtcDate(new Date(subscription.nextBillingDate)));
}

type UpcomingPaymentsProps = {
  subscriptions: UpcomingSubscription[];
  daysAhead?: number;
  onSelectSubscription?: (id: string) => void;
};

export function UpcomingPayments({
  subscriptions,
  daysAhead = 7,
  onSelectSubscription,
}: UpcomingPaymentsProps) {
  const router = useRouter();
  const { currency: userCurrency } = useCurrency();
  const billsEnabled = useFeature('bills');

  // Active subscriptions due in the next X days, counted in calendar days from the user's today.
  const today = localToday();

  const upcomingPayments = subscriptions
    .filter(sub => {
      if (sub.status !== 'active') return false;
      if (!sub.nextBillingDate) return false;

      const days = daysUntilBilling(sub, today);
      return days >= 0 && days <= daysAhead;
    })
    .sort((a, b) => {
      const dateA = new Date(a.nextBillingDate!);
      const dateB = new Date(b.nextBillingDate!);
      return dateA.getTime() - dateB.getTime();
    });

  if (upcomingPayments.length === 0) {
    return null;
  }

  // Each at its next payment's amount: this month's own where one is set (a card bill's €809).
  const totalUpcoming = totalsByCurrency(
    upcomingPayments.map((sub) => ({ amount: nextPaymentAmount(sub).amount, currency: sub.currency })),
    userCurrency,
  );

  const handleClick = (subscriptionId: string) => {
    if (onSelectSubscription) {
      onSelectSubscription(subscriptionId);
    } else {
      router.push(`/subscriptions?selected=${subscriptionId}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Upcoming payments
            </CardTitle>
            <CardDescription>
              Next {daysAhead} days · {upcomingPayments.length} payment{upcomingPayments.length === 1 ? '' : 's'}
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="amount text-2xl font-bold">{formatTotals(totalUpcoming, userCurrency)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {upcomingPayments.map((subscription) => {
            // "Goes out today" for a direct debit (nothing to do, so never red); "Due today" in red
            // only for one paid by hand (shared/labels/subscriptions.ts).
            const { label, urgency } = nextPaymentLabel(fromUtcDate(new Date(subscription.nextBillingDate)), today, subscription.paymentMethod);
            const amount = nextPaymentAmount(subscription);

            return (
              <div
                key={subscription.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                onClick={() => handleClick(subscription.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate">{subscription.name}</p>
                    {subscription.category && (
                      <Badge variant="outline" className="text-xs">
                        {subscription.category}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    {/* One label: a row due today said both "Today" and "Due Today". */}
                    {urgency === 'due' ? (
                      <Badge variant="destructive" className="text-xs">{label}</Badge>
                    ) : (
                      <span className={urgency === 'soon' ? 'text-warning' : undefined}>{label}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className={cn('amount font-semibold', amount.estimated && 'text-muted-foreground')}>{amount.estimated ? '~' : ''}{formatCurrency(amount.amount, subscription.currency)}</p>
                    <p className="text-xs text-muted-foreground">{frequencyLabel(subscription.billingFrequency, subscription.customFrequencyDays)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/subscriptions')}
          >
            {billsEnabled ? 'View all bills' : 'View all subscriptions'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
