'use client';

import { Calendar, ExternalLink, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Subscription } from '@/lib/db/schema';
import { useCurrency } from '@/lib/hooks/use-currency';
import { differenceInDays, format, isToday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';
import { urgencySurfaceClass, urgencyTextClass, urgencyTintClass } from '@/lib/utils/urgency';

type NextSubscriptionCardProps = {
  subscription: Subscription;
  onClick: () => void;
};

export function NextSubscriptionCard({ subscription, onClick }: NextSubscriptionCardProps) {
  const { format: formatCurrency } = useCurrency();
  const now = new Date();
  const billingDate = subscription.nextBillingDate ? new Date(subscription.nextBillingDate) : null;
  const daysUntil = billingDate ? differenceInDays(billingDate, now) : null;

  const getDateLabel = () => {
    if (!billingDate) return '';
    if (isToday(billingDate)) return 'Due Today';
    if (isTomorrow(billingDate)) return 'Due Tomorrow';
    if (daysUntil !== null && daysUntil <= 7) return `Due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
    return `Due ${format(billingDate, 'MMM dd, yyyy')}`;
  };

  return (
    <Card
      className={cn(
        'relative cursor-pointer overflow-hidden border-2 transition-colors hover:border-primary/50',
        daysUntil !== null ? urgencySurfaceClass(daysUntil) : '',
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
          {/* Left Section - Subscription Info */}
          <div className="flex-1 space-y-3 sm:space-y-3">
            <div className="flex items-start gap-3 sm:gap-4">
              {/* Icon */}
              <div className={cn(
                'shrink-0 rounded-xl p-2 sm:p-3',
                daysUntil !== null ? urgencyTintClass(daysUntil) : 'bg-muted',
              )}>
                <Clock
                  className={cn(
                    'h-5 w-5 sm:h-6 sm:w-6',
                    daysUntil !== null ? urgencyTextClass(daysUntil) : 'text-muted-foreground',
                  )}
                  aria-hidden="true"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="truncate text-lg font-semibold sm:text-xl">{subscription.name}</h3>
                  {subscription.isBusinessExpense && (
                    <Badge variant="secondary" className="text-xs">Business</Badge>
                  )}
                  <Badge
                    variant={subscription.status === 'active' ? 'default' : 'secondary'}
                    className="capitalize text-xs"
                  >
                    {subscription.status}
                  </Badge>
                </div>

                {subscription.description && (
                  <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 line-clamp-1">
                    {subscription.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {subscription.category && (
                    <Badge variant="outline" className="text-xs">
                      {subscription.category}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {subscription.billingFrequency}
                  </Badge>
                  {subscription.website && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <ExternalLink className="w-3 h-3" />
                      Website
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Section - Payment Info */}
          <div className="flex flex-col items-start sm:items-end gap-4 sm:gap-2 w-full sm:w-auto">
            <div className="text-left sm:text-right w-full sm:w-auto">
              <div className="flex items-baseline gap-1 sm:justify-end">
                <span className="amount text-2xl font-semibold tracking-tight sm:text-3xl">
                  {formatCurrency(parseFloat(subscription.amount))}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
                {subscription.billingFrequency}
              </p>
            </div>

            {billingDate && (
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium w-full sm:w-auto">
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className={daysUntil !== null ? urgencyTextClass(daysUntil) : undefined}>
                  {getDateLabel()}
                </span>
              </div>
            )}

            <Button
              size="sm"
              className="mt-0 sm:mt-1 w-full sm:w-auto"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
