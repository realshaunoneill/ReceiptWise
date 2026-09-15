'use client';

import { TrendingUp, Calendar, Link2, PieChart, Pause, XCircle, PlayCircle, CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { CreateSubscriptionDialog } from './create-subscription-dialog';

type SubscriptionEmptyStateProps = {
  status: string;
};

export function SubscriptionEmptyState({ status }: SubscriptionEmptyStateProps) {
  if (status === 'paused') {
    return (
      <Card className="border-dashed bg-muted/30">
        <CardContent className="flex flex-col items-center justify-center py-12 px-6">
          <div className="mb-4 rounded-full bg-warning/10 p-4">
            <Pause className="h-8 w-8 text-warning" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No paused subscriptions</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
            When you pause a subscription, it will appear here. Pausing is useful for services you&apos;re temporarily not using.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PlayCircle className="h-4 w-4" />
            <span>Paused subscriptions can be resumed at any time</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === 'cancelled') {
    return (
      <Card className="border-dashed bg-muted/30">
        <CardContent className="flex flex-col items-center justify-center py-12 px-6">
          <div className="rounded-full bg-muted p-4 mb-4">
            <XCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No cancelled subscriptions</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
            Cancelled subscriptions appear here for your records. You can reactivate them if needed.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Keep track of your subscription history</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status !== 'active') {
    return (
      <Card className="bg-muted/30">
        <CardContent className="flex flex-col items-center justify-center py-12 px-6">
          <div className="rounded-full bg-muted p-4 mb-4">
            <CreditCard className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No {status} subscriptions</h3>
          <p className="text-sm text-muted-foreground text-center">
            You don&apos;t have any {status} subscriptions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    /* "Payment Reminders / Never miss a due date" was one of three tiles here.
       No reminder is ever sent — the app shows upcoming payments when you look at
       it. The tiles say what actually happens. */
    <Card className="border-dashed">
      <CardContent className="px-6 py-12">
        <div className="mx-auto max-w-lg">
          {/* Icon */}
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>

          {/* Title & Description */}
          <h3 className="mb-2 text-xl font-semibold text-foreground">No subscriptions yet</h3>
          <p className="mb-8 text-muted-foreground">
            Add the recurring payments you already have — streaming, phone, insurance — and
            they get totalled and tracked alongside your receipts.
          </p>

          {/* Benefits */}
          <div className="mb-8 grid w-full grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <Calendar className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium">What is due next</p>
              <p className="text-xs text-muted-foreground">Shown on this page and the dashboard</p>
            </div>
            <div>
              <PieChart className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium">Monthly and yearly cost</p>
              <p className="text-xs text-muted-foreground">Per subscription and in total</p>
            </div>
            <div>
              <Link2 className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium">Matched to receipts</p>
              <p className="text-xs text-muted-foreground">Link the receipt that proves a payment</p>
            </div>
          </div>

          {/* CTA */}
          <CreateSubscriptionDialog />
        </div>
      </CardContent>
    </Card>
  );
}
