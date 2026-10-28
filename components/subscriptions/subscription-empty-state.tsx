'use client';

import { TrendingUp, Calendar, Pause, XCircle, PlayCircle, CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useFeature } from '@/lib/hooks/use-user';
import { CreateSubscriptionDialog } from './create-subscription-dialog';

type SubscriptionEmptyStateProps = {
  status: string;
  kind?: 'all' | 'bill' | 'subscription';
};

export function SubscriptionEmptyState({ status, kind = 'all' }: SubscriptionEmptyStateProps) {
  const billsEnabled = useFeature('bills');
  // What the list holds: with bills on it's both kinds unless the page narrowed it to one.
  const things = !billsEnabled || kind === 'subscription' ? 'subscriptions' : kind === 'bill' ? 'bills' : 'bills or subscriptions';

  if (status === 'paused') {
    return (
      <Card className="border-dashed bg-muted/30">
        <CardContent className="flex flex-col items-center justify-center py-12 px-6">
          <div className="mb-4 rounded-full bg-warning/10 p-4">
            <Pause className="h-8 w-8 text-warning" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No paused {things}</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
            Anything you pause appears here. Pausing is useful for services you&apos;re temporarily not using.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PlayCircle className="h-4 w-4" />
            <span>You can resume it at any time</span>
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
          <h3 className="text-lg font-semibold text-foreground mb-2">No cancelled {things}</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
            Anything you cancel stays here for your records. You can reactivate it if needed.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Your payment history is kept</span>
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
          <h3 className="text-lg font-semibold text-foreground mb-2">No {status} {things}</h3>
          <p className="text-sm text-muted-foreground text-center">
            You don&apos;t have any {status} {things}.
          </p>
        </CardContent>
      </Card>
    );
  }

  // The Active tab narrowed to one kind: no need for the whole introduction.
  if (kind !== 'all' && billsEnabled) {
    return (
      <Card className="border-dashed bg-muted/30">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-12 px-6">
          <h3 className="text-lg font-semibold text-foreground">No active {things}</h3>
          <CreateSubscriptionDialog />
        </CardContent>
      </Card>
    );
  }

  // One sentence and one action, as in the app: three "benefit" tiles under it said what the page
  // would show once something was added, which adding one shows anyway.
  return (
    <Card className="border-dashed">
      <CardContent className="px-6 py-12">
        <div className="mx-auto max-w-lg">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-foreground">{billsEnabled ? 'No bills yet' : 'No subscriptions yet'}</h3>
          <p className="mb-6 text-muted-foreground">
            {billsEnabled
              ? 'Add your rent, electricity and phone, and the plan shows what’s left after them.'
              : 'Add the recurring payments you already have, like streaming, phone and insurance, and they get totalled and tracked alongside your receipts.'}
          </p>
          <CreateSubscriptionDialog />
        </div>
      </CardContent>
    </Card>
  );
}
