'use client';

import { Calendar, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { type Subscription } from '@/lib/db/schema';
import { useCurrency } from '@/lib/hooks/use-currency';
import { useFeature } from '@/lib/hooks/use-user';
import { daysBetween, formatLocalDate, fromUtcDate, localToday } from '@/lib/dates/local-date';
import { frequencyLabel } from '@/lib/schedule/billing-schedule';
import { formatCurrency } from '@/lib/utils/currency';
import { formatTotals, totalsByCurrency } from '@/lib/utils/currency-totals';

/** Days from today to a subscription's next billing day (stored as midnight UTC of that day). */
function daysUntilBilling(subscription: Subscription, today: string): number {
  return daysBetween(today, fromUtcDate(new Date(subscription.nextBillingDate)));
}

type UpcomingPaymentsProps = {
  subscriptions: Subscription[];
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

  const totalUpcoming = totalsByCurrency(
    upcomingPayments.map((sub) => ({ amount: sub.amount, currency: sub.currency })),
    userCurrency,
  );

  const getDateLabel = (subscription: Subscription, days: number) => {
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return `In ${days} days`;
    return formatLocalDate(fromUtcDate(new Date(subscription.nextBillingDate)), { day: 'numeric', month: 'short' }, 'en-IE');
  };

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
              Next {daysAhead} days • {upcomingPayments.length} payment{upcomingPayments.length === 1 ? '' : 's'}
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
            const daysUntil = daysUntilBilling(subscription, today);
            const isUrgent = daysUntil <= 2;

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
                    {isUrgent ? (
                      <Badge variant="destructive" className="text-xs">
                        {daysUntil === 0 ? 'Due today' : getDateLabel(subscription, daysUntil)}
                      </Badge>
                    ) : (
                      <span>{getDateLabel(subscription, daysUntil)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="amount font-semibold">{formatCurrency(parseFloat(subscription.amount), subscription.currency)}</p>
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
