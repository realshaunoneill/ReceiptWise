'use client';

import { AlertCircle, ExternalLink, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LinkReceiptDialog } from './link-receipt-dialog';
import { type Subscription, type SubscriptionPayment } from '@/lib/db/schema';
import { useCurrency } from '@/lib/hooks/use-currency';
import { differenceInDays, format, isToday, isTomorrow, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

type SubscriptionWithPayments = Subscription & {
  missingPayments?: number;
  recentPayments?: SubscriptionPayment[];
};

type SubscriptionCardProps = {
  subscription: SubscriptionWithPayments;
  onClick: () => void;
};

export function SubscriptionCard({ subscription, onClick }: SubscriptionCardProps) {
  const { format: formatCurrency } = useCurrency();

  // Calculate next payment info
  let nextPaymentInfo = null;
  if (subscription.nextBillingDate) {
    const billingDate = startOfDay(new Date(subscription.nextBillingDate));
    const today = startOfDay(new Date());
    const daysUntil = differenceInDays(billingDate, today);

    if (daysUntil >= 0) {
      const getDateLabel = () => {
        if (isToday(billingDate)) return 'Today';
        if (isTomorrow(billingDate)) return 'Tomorrow';
        if (daysUntil <= 7) return `In ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
        return format(billingDate, 'MMM dd');
      };

      const getBadgeVariant = () => {
        if (daysUntil === 0) return 'destructive' as const;
        if (daysUntil <= 2) return 'secondary' as const;
        if (daysUntil <= 7) return 'default' as const;
        return 'outline' as const;
      };

      nextPaymentInfo = {
        label: getDateLabel(),
        date: format(billingDate, 'MMM dd, yyyy'),
        variant: getBadgeVariant(),
        daysUntil,
      };
    }
  }

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-300 cursor-pointer',
        'hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1',
      )}
      onClick={onClick}
    >
      <CardContent className="relative p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold truncate">{subscription.name}</h3>
              {subscription.isBusinessExpense && (
                <Badge variant="secondary" className="text-xs">Business</Badge>
              )}
            </div>
            {subscription.category && (
              <Badge variant="outline" className="text-xs capitalize mt-1">
                {subscription.category}
              </Badge>
            )}
          </div>
          <Badge
            variant={subscription.status === 'active' ? 'default' : 'secondary'}
            className="capitalize shrink-0"
          >
            {subscription.status}
          </Badge>
        </div>

        {/* Amount & Next Payment Section */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-baseline gap-2">
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
            <span className="text-3xl font-bold tracking-tight">
              {formatCurrency(parseFloat(subscription.amount))}
            </span>
            <span className="text-sm text-muted-foreground font-medium">
              per {subscription.billingFrequency}
            </span>
          </div>

          {nextPaymentInfo && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">
                {nextPaymentInfo.label}
              </span>
              <span className="text-muted-foreground">
                • {nextPaymentInfo.date}
              </span>
              {nextPaymentInfo.daysUntil === 0 && (
                <Badge variant="destructive" className="ml-auto text-xs">
                  Due Today
                </Badge>
              )}
              {nextPaymentInfo.daysUntil === 1 && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  Tomorrow
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Website Link */}
        {subscription.website && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground border-t pt-3">
            <ExternalLink className="w-4 h-4" />
            <span className="truncate">{subscription.website}</span>
          </div>
        )}

        {/* Missing Payments Alert */}
        {subscription.missingPayments !== undefined && subscription.missingPayments > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning/25 bg-warning/10 p-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <span className="text-sm font-medium text-warning">
              {subscription.missingPayments} missing {subscription.missingPayments === 1 ? 'receipt' : 'receipts'}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 border-t pt-3 mt-3">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            View Details
          </Button>
          <LinkReceiptDialog
            subscription={subscription}
            payments={subscription.recentPayments || []}
          >
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              Link Receipt
            </Button>
          </LinkReceiptDialog>
        </div>
      </CardContent>
    </Card>
  );
}
