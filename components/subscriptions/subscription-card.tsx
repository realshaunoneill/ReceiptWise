'use client';

import { AlertCircle, ExternalLink, Calendar, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type Subscription, type SubscriptionPayment } from '@/lib/db/schema';
import { daysBetween, formatLocalDate, fromUtcDate, localToday } from '@/lib/dates/local-date';
import { useFeature } from '@/lib/hooks/use-user';
import { frequencyLabel } from '@/lib/schedule/billing-schedule';
import { formatCurrency } from '@/lib/utils/currency';
import { cn } from '@/lib/utils';
import { nextPaymentAmount, nextPaymentLabel, statusLabel } from './labels';

type SubscriptionWithPayments = Subscription & {
  missingPayments?: number;
  recentPayments?: SubscriptionPayment[];
  /** The next cycle's own amount, when it has one (GET /api/subscriptions). */
  nextAmount?: string | null;
};

type SubscriptionCardProps = {
  subscription: SubscriptionWithPayments;
  onClick: () => void;
};

/**
 * When it's next: "Goes out in 3 days" for a direct debit, "Due in 3 days" for one paid by hand,
 * with the date beside it within a week, and just the date further out. Only a payment you make
 * yourself turns red on the day (shared/labels/subscriptions.ts).
 */
function nextPayment(nextBillingDate: Date | string | null, paymentMethod: string | null) {
  if (!nextBillingDate) return null;
  // Midnight UTC of the billing day: read it as that calendar day, not in the browser's zone
  // (a day early west of UTC).
  const billingDay = fromUtcDate(new Date(nextBillingDate));
  const today = localToday();
  const daysUntil = daysBetween(today, billingDay);
  if (daysUntil < 0) return null;

  const date = formatLocalDate(billingDay, { day: 'numeric', month: 'short', year: 'numeric' }, 'en-IE');
  const { label, urgency } = nextPaymentLabel(billingDay, today, paymentMethod);
  return { relative: daysUntil < 7 ? label : null, date, urgency };
}

export function SubscriptionCard({ subscription, onClick }: SubscriptionCardProps) {
  const billsEnabled = useFeature('bills');
  const next = nextPayment(subscription.nextBillingDate, subscription.paymentMethod);
  const notMarkedPaid = subscription.missingPayments ?? 0;
  // This month's own amount where one is set: a card bill that's usually €0 with €809 for November.
  const amount = nextPaymentAmount(subscription);

  return (
    <>
      <Card
        className={cn(
          'group relative overflow-hidden transition-all duration-300 cursor-pointer',
          'hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1',
        )}
        onClick={onClick}
      >
        <CardContent className="relative space-y-4 p-4 sm:p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-bold truncate">{subscription.name}</h3>
                {subscription.isBusinessExpense && (
                  <Badge variant="secondary" className="text-xs">Business</Badge>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {/* Essentials are the usual case; only the nice-to-haves are marked. */}
                {billsEnabled && subscription.kind !== 'bill' && (
                  <Badge variant="secondary" className="text-xs">Subscription</Badge>
                )}
                {subscription.category && (
                  <Badge variant="outline" className="text-xs">{subscription.category}</Badge>
                )}
                {subscription.householdId && (
                  <Badge variant="outline" className="text-xs">
                    <Users className="mr-1 h-3 w-3" aria-hidden="true" />Shared
                  </Badge>
                )}
              </div>
            </div>
            {/* Only when it isn't the usual: every card on the Active tab said "Active". */}
            {subscription.status !== 'active' && (
              <Badge variant="secondary" className="shrink-0">{statusLabel(subscription.status)}</Badge>
            )}
          </div>

          {/* Amount & Next Payment Section */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-baseline gap-2">
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
              <span className={cn('amount text-3xl font-bold tracking-tight', amount.estimated && 'text-muted-foreground')}>
                {amount.estimated ? '~' : ''}{formatCurrency(amount.amount, subscription.currency)}
              </span>
              <span className="text-sm text-muted-foreground font-medium">
                {frequencyLabel(subscription.billingFrequency, subscription.customFrequencyDays)}
              </span>
            </div>

            {next && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                {next.relative ? (
                  <>
                    <span className={cn('font-medium', next.urgency === 'due' && 'text-destructive', next.urgency === 'soon' && 'text-warning')}>{next.relative}</span>
                    <span className="text-muted-foreground">· {next.date}</span>
                  </>
                ) : (
                  <span className="font-medium">{next.date}</span>
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

          {/* Payments past due that nobody has marked paid (automatic payments are never counted) */}
          {notMarkedPaid > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning/25 bg-warning/10 p-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <span className="text-sm font-medium text-warning">
                {notMarkedPaid} overdue
              </span>
            </div>
          )}

          {/* One way in, for the keyboard too: linking a receipt, editing and the payments are in the details. */}
          <div className="border-t pt-3 mt-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
            >
              View details
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
