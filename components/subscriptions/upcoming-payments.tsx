'use client';

import { Calendar, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { type Subscription } from '@/lib/db/schema';
import { useCurrency } from '@/lib/hooks/use-currency';
import { differenceInDays, format, isToday, isTomorrow, addDays } from 'date-fns';

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
  const { format: formatCurrency } = useCurrency();

  // Filter for active subscriptions with upcoming payments in the next X days.
  // Billing dates are stored as midnight UTC, so compare from the start of today — comparing
  // against the current time dropped anything due today.
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const futureDate = addDays(now, daysAhead);

  const upcomingPayments = subscriptions
    .filter(sub => {
      if (sub.status !== 'active') return false;
      if (!sub.nextBillingDate) return false;

      const billingDate = new Date(sub.nextBillingDate);
      return billingDate >= now && billingDate <= futureDate;
    })
    .sort((a, b) => {
      const dateA = new Date(a.nextBillingDate!);
      const dateB = new Date(b.nextBillingDate!);
      return dateA.getTime() - dateB.getTime();
    });

  if (upcomingPayments.length === 0) {
    return null;
  }

  const totalUpcoming = upcomingPayments.reduce((sum, sub) => sum + parseFloat(sub.amount), 0);

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    const days = differenceInDays(date, now);
    if (days <= 7) return `In ${days} day${days === 1 ? '' : 's'}`;
    return format(date, 'MMM dd');
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
              Upcoming Payments
            </CardTitle>
            <CardDescription>
              Next {daysAhead} days • {upcomingPayments.length} payment{upcomingPayments.length === 1 ? '' : 's'}
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{formatCurrency(totalUpcoming)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {upcomingPayments.map((subscription) => {
            const billingDate = new Date(subscription.nextBillingDate!);
            const daysUntil = differenceInDays(billingDate, now);
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
                    <span>{getDateLabel(billingDate)}</span>
                    {isUrgent && (
                      <Badge variant="destructive" className="text-xs">
                        {isToday(billingDate) ? 'Due Today' : 'Due Soon'}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(parseFloat(subscription.amount))}</p>
                    <p className="text-xs text-muted-foreground">{subscription.billingFrequency}</p>
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
            View All Subscriptions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
