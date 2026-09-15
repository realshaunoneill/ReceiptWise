'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Crown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/hooks/use-user';

interface SubscriptionBannerProps {
  page?: string;
}

/*
 * Five variants of "Unlock/Enhanced/Premium <Noun Phrase>" with no concrete
 * content between them. Each now says what the reader gets on the page they are
 * actually looking at.
 */
const pageMessages = {
  dashboard: {
    title: 'This page fills in with a subscription',
    description: 'Totals, categories and trends, once there are receipts to read.',
  },
  receipts: {
    title: 'Adding receipts needs a subscription',
    description: 'Everything already here stays readable.',
  },
  sharing: {
    title: 'Households need a subscription',
    description: 'Share one receipt pile with family, a partner or flatmates.',
  },
  settings: {
    title: 'You are on the free plan',
    description: 'Read-only access to what is already in your account.',
  },
  default: {
    title: 'You are on the free plan',
    description: 'Unlimited receipts, households and insights come with Premium.',
  },
};

export function SubscriptionBanner({ page = 'default' }: SubscriptionBannerProps) {
  const router = useRouter();
  const [isDismissed, setIsDismissed] = useState(false);
  const { user, isSubscribed } = useUser();

  // Don't show banner if user is subscribed, dismissed, or not loaded
  if (isSubscribed || isDismissed || !user) {
    return null;
  }

  const message = pageMessages[page as keyof typeof pageMessages] || pageMessages.default;
  const trialDays = process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS
    ? parseInt(process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS)
    : 0;

  const handleSubscribe = () => {
    router.push('/upgrade');
  };

  return (
    <div className="mx-4 mb-6 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Crown className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-foreground truncate">{message.title}</h3>
              {trialDays > 0 && (
                <span className="hidden sm:inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {trialDays}-day free trial
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">{message.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={handleSubscribe} size="sm" className="gap-1.5">
            <span className="hidden sm:inline">See Premium</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDismissed(true)}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
