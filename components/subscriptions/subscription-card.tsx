'use client';

import { useState } from 'react';
import { AlertCircle, ExternalLink, Calendar, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LinkReceiptDialog } from './link-receipt-dialog';
import { type Subscription, type SubscriptionPayment } from '@/lib/db/schema';
import { daysBetween, formatLocalDate, fromUtcDate, localToday } from '@/lib/dates/local-date';
import { useFeature } from '@/lib/hooks/use-user';
import { frequencyLabel } from '@/lib/schedule/billing-schedule';
import { formatCurrency } from '@/lib/utils/currency';
import { cn } from '@/lib/utils';
import { statusLabel } from './labels';

type SubscriptionWithPayments = Subscription & {
  missingPayments?: number;
  recentPayments?: SubscriptionPayment[];
};

type SubscriptionCardProps = {
  subscription: SubscriptionWithPayments;
  onClick: () => void;
};

/**
 * When it's next due: "Today", "Tomorrow" or "In 3 days" with the date beside it, and just the
 * date further out. The card used to show "Nov 01 • Nov 1, 2026", the same day twice.
 */
function nextPayment(nextBillingDate: Date | string | null) {
  if (!nextBillingDate) return null;
  // Midnight UTC of the billing day: read it as that calendar day, not in the browser's zone
  // (a day early west of UTC).
  const billingDay = fromUtcDate(new Date(nextBillingDate));
  const daysUntil = daysBetween(localToday(), billingDay);
  if (daysUntil < 0) return null;

  const date = formatLocalDate(billingDay, { day: 'numeric', month: 'short', year: 'numeric' }, 'en-IE');
  const relative = daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : daysUntil <= 7 ? `In ${daysUntil} days` : null;
  return { relative, date, daysUntil };
}

export function SubscriptionCard({ subscription, onClick }: SubscriptionCardProps) {
  const billsEnabled = useFeature('bills');
  const [linkOpen, setLinkOpen] = useState(false);
  const next = nextPayment(subscription.nextBillingDate);
  const notMarkedPaid = subscription.missingPayments ?? 0;

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
                {billsEnabled && subscription.kind === 'bill' && (
                  <Badge variant="secondary" className="text-xs">Bill</Badge>
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
            <Badge
              variant={subscription.status === 'active' ? 'default' : 'secondary'}
              className="shrink-0"
            >
              {statusLabel(subscription.status)}
            </Badge>
          </div>

          {/* Amount & Next Payment Section */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-baseline gap-2">
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
              <span className="amount text-3xl font-bold tracking-tight">
                {formatCurrency(parseFloat(subscription.amount), subscription.currency)}
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
                    <span className={cn('font-medium', next.daysUntil === 0 && 'text-destructive')}>{next.relative}</span>
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
                {notMarkedPaid} not marked paid
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
              View details
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                setLinkOpen(true);
              }}
            >
              Link receipt
            </Button>
          </div>
        </CardContent>
      </Card>
      {/*
        Outside the card: React sends clicks inside a portal up the component tree, so with the
        dialog inside the clickable card every click in it also opened the detail modal on top.
      */}
      <LinkReceiptDialog
        subscription={subscription}
        payments={subscription.recentPayments || []}
        open={linkOpen}
        onOpenChange={setLinkOpen}
      />
    </>
  );
}
