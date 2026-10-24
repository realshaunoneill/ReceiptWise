'use client';

import { SubscriptionCard } from './subscription-card';
import { SubscriptionListSkeleton } from './subscription-list-skeleton';
import { SubscriptionEmptyState } from './subscription-empty-state';
import { type Subscription, type SubscriptionPayment } from '@/lib/db/schema';

type SubscriptionWithPayments = Subscription & {
  missingPayments?: number;
  recentPayments?: SubscriptionPayment[];
};

type SubscriptionListProps = {
  subscriptions?: SubscriptionWithPayments[];
  isLoading: boolean;
  status: string;
  /** The kind filter on the page, so an empty list says what it is empty of. */
  kind?: 'all' | 'bill' | 'subscription';
  onSelectSubscription: (id: string) => void;
};

export function SubscriptionList({
  subscriptions,
  isLoading,
  status,
  kind = 'all',
  onSelectSubscription,
}: SubscriptionListProps) {
  if (isLoading) {
    return <SubscriptionListSkeleton />;
  }

  if (!subscriptions || subscriptions.length === 0) {
    return <SubscriptionEmptyState status={status} kind={kind} />;
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {subscriptions.map((subscription) => (
        <SubscriptionCard
          key={subscription.id}
          subscription={subscription}
          onClick={() => onSelectSubscription(subscription.id)}
        />
      ))}
    </div>
  );
}
