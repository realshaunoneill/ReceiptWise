'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp } from 'lucide-react';
import { type Subscription } from '@/lib/db/schema';
import { useCurrency } from '@/lib/hooks/use-currency';
import { urgencyTextClass } from '@/lib/utils/urgency';
import { cn } from '@/lib/utils';
import { differenceInDays, format, isToday, isTomorrow, startOfDay } from 'date-fns';

type UpcomingSubscriptionCardProps = {
  subscription: Subscription;
  onClick?: () => void;
};

export function UpcomingSubscriptionCard({ subscription, onClick }: UpcomingSubscriptionCardProps) {
  const { format: formatCurrency } = useCurrency();

  if (!subscription.nextBillingDate) return null;

  const billingDate = startOfDay(new Date(subscription.nextBillingDate));
  const today = startOfDay(new Date());
  const daysUntil = differenceInDays(billingDate, today);

  const getDateLabel = () => {
    if (isToday(billingDate)) return 'Today';
    if (isTomorrow(billingDate)) return 'Tomorrow';
    if (daysUntil <= 7) return `In ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
    return format(billingDate, 'MMM dd, yyyy');
  };

  return (
    <Card
      className="cursor-pointer transition-colors hover:border-primary/50"
      onClick={onClick}
    >
      <CardContent className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="mb-1 truncate text-xl font-semibold">{subscription.name}</h3>
            {subscription.category && (
              <Badge variant="outline" className="text-xs capitalize">
                {subscription.category}
              </Badge>
            )}
          </div>
          {daysUntil === 0 ? (
            <Badge variant="destructive" className="shrink-0">
              Due Today
            </Badge>
          ) : daysUntil === 1 ? (
            <Badge variant="secondary" className="shrink-0">
              Tomorrow
            </Badge>
          ) : null}
        </div>

        {/* Date */}
        <div className="flex items-center gap-2 text-sm border-t pt-3">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className={cn('font-semibold', urgencyTextClass(daysUntil))}>
            {getDateLabel()}
          </span>
          <span className="text-muted-foreground">
            • {format(billingDate, 'MMM dd, yyyy')}
          </span>
        </div>

        {/* Amount */}
        <div className="flex items-baseline justify-between border-t pt-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground capitalize">
              {subscription.billingFrequency}
            </span>
          </div>
          <span className="amount text-3xl font-semibold tracking-tight">
            {formatCurrency(parseFloat(subscription.amount))}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
