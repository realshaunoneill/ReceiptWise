'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp } from 'lucide-react';
import { type Subscription } from '@/lib/db/schema';
import { urgencyTextClass } from '@/lib/utils/urgency';
import { cn } from '@/lib/utils';
import { daysBetween, formatLocalDate, fromUtcDate, localToday } from '@/lib/dates/local-date';
import { frequencyLabel } from '@/lib/schedule/billing-schedule';
import { formatCurrency } from '@/lib/utils/currency';

type UpcomingSubscriptionCardProps = {
  subscription: Subscription;
  onClick?: () => void;
};

export function UpcomingSubscriptionCard({ subscription, onClick }: UpcomingSubscriptionCardProps) {
  if (!subscription.nextBillingDate) return null;

  // Midnight UTC of the billing day, read as that calendar day rather than in the browser's zone.
  const billingDay = fromUtcDate(new Date(subscription.nextBillingDate));
  const daysUntil = daysBetween(localToday(), billingDay);

  // "In 3 days · 27 Oct 2026", or just the date further out: it used to show
  // "Nov 1, 2026 • Nov 1, 2026", and "Due Today" in the corner as well as "Today" here.
  const date = formatLocalDate(billingDay, { day: 'numeric', month: 'short', year: 'numeric' }, 'en-IE');
  const relative = daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : daysUntil <= 7 ? `In ${daysUntil} days` : null;

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary/50"
      onClick={onClick}
    >
      <CardContent className="space-y-4 p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="mb-1 truncate text-xl font-semibold">{subscription.name}</h3>
            {subscription.category && (
              <Badge variant="outline" className="text-xs">
                {subscription.category}
              </Badge>
            )}
          </div>
        </div>

        {/* Date */}
        <div className="flex items-center gap-2 text-sm border-t pt-3">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className={cn('font-semibold', urgencyTextClass(daysUntil))}>
            {relative ?? date}
          </span>
          {relative && <span className="text-muted-foreground">· {date}</span>}
        </div>

        {/* Amount */}
        <div className="flex items-baseline justify-between border-t pt-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {frequencyLabel(subscription.billingFrequency, subscription.customFrequencyDays)}
            </span>
          </div>
          <span className="amount text-3xl font-semibold tracking-tight">
            {formatCurrency(parseFloat(subscription.amount), subscription.currency)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
