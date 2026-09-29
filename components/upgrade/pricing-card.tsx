'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Check, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { useTrialDays } from '@/lib/hooks/use-trial-days';

type BillingInterval = 'monthly' | 'annual';

export function PricingCard() {
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>('annual');
  const trialDays = useTrialDays();

  // Fetch pricing details from API
  const { data: pricing, isLoading } = useQuery({
    queryKey: ['pricing'],
    queryFn: async () => {
      const response = await fetch('/api/pricing');
      if (!response.ok) {
        throw new Error('Failed to fetch pricing');
      }
      return response.json();
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      });

      if (!response.ok) {
        // The API returns a user-facing message (e.g. "You already have a subscription").
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Failed to start checkout. Please try again.');
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        if (trialDays > 0) {
          toast.success(`Starting your ${trialDays}-day free trial...`);
        }
        window.location.href = data.url;
      }
    },
    onError: (error) => {
      console.error('Error creating checkout session:', error);
      toast.error(error.message);
    },
  });

  const handleUpgrade = () => {
    const priceId = selectedInterval === 'annual' && pricing?.annual
      ? pricing.annual.priceId
      : pricing?.monthly?.priceId;

    if (priceId) {
      upgradeMutation.mutate(priceId);
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amount / 100);
  };

  const monthlyPrice = pricing?.monthly ? formatPrice(pricing.monthly.amount, pricing.monthly.currency) : null;
  const annualPrice = pricing?.annual ? formatPrice(pricing.annual.amount, pricing.annual.currency) : null;
  const annualMonthlyEquivalent = pricing?.annual ? formatPrice(pricing.annual.amount / 12, pricing.annual.currency) : null;

  // Calculate savings percentage
  const savingsPercentage = pricing?.monthly && pricing?.annual
    ? Math.round(((pricing.monthly.amount * 12 - pricing.annual.amount) / (pricing.monthly.amount * 12)) * 100)
    : 17; // Default to 17% (2 months free)

  if (isLoading) {
    return (
      <Card className="max-w-md mx-auto border-2 border-primary/50 shadow-lg">
        <CardHeader className="text-center pb-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto mt-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative mx-auto max-w-md overflow-hidden border-2 border-primary/50">
      {/* Torn top edge, echoing the paper this app is built around. Replaces a
          floating blurred circle in the corner. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1.5 bg-[repeating-linear-gradient(90deg,var(--primary)_0_6px,transparent_6px_12px)] opacity-60"
      />
      <CardHeader className="relative pb-4 text-center">
        <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
          <Crown className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <CardTitle className="text-2xl font-semibold text-foreground sm:text-3xl">Premium</CardTitle>
        <CardDescription className="text-base">
          The whole app. There is only one plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 relative">
        {/* Billing Toggle */}
        {pricing?.annual && (
          <div className="flex items-center justify-center gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setSelectedInterval('monthly')}
              className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
                selectedInterval === 'monthly'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setSelectedInterval('annual')}
              className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all relative ${
                selectedInterval === 'annual'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Annual
              <Badge variant="default" className="ml-2 text-xs">
                Save {savingsPercentage}%
              </Badge>
            </button>
          </div>
        )}

        {/* Pricing Display */}
        <div className="py-2 text-center">
          <div className="flex items-baseline justify-center gap-2">
            <span className="amount text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {selectedInterval === 'annual' && annualMonthlyEquivalent
                ? annualMonthlyEquivalent
                : monthlyPrice}
            </span>
            <span className="text-muted-foreground">a month</span>
          </div>
          {selectedInterval === 'annual' && annualPrice && (
            <p className="amount mt-2 text-sm text-muted-foreground">
              {annualPrice} billed once a year
            </p>
          )}
          {trialDays > 0 && (
            <Badge variant="secondary" className="mt-4">
              First {trialDays} days free
            </Badge>
          )}
        </div>

        {/* Benefits for annual plan */}
        {selectedInterval === 'annual' && pricing?.annual && (
          /* "2 months completely free" was stated flatly, whatever the two Stripe
             prices happen to be — the saving is computed a few lines up and was
             already being shown as a badge on the Annual toggle. */
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{savingsPercentage}% cheaper than paying by the month</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>This price is held for the year</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>One payment to think about instead of twelve</span>
              </li>
            </ul>
          </div>
        )}

        <Button
          onClick={handleUpgrade}
          disabled={upgradeMutation.isPending || !pricing}
          size="lg"
          className="h-12 w-full text-base"
        >
          {upgradeMutation.isPending ? (
            'One moment…'
          ) : (
            <>
              {trialDays > 0 ? `Start the ${trialDays}-day trial` : 'Subscribe'}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          {trialDays > 0
            ? 'Card details are needed to begin. Cancel during the trial and nothing is charged.'
            : 'Cancel any time.'}
        </p>
      </CardContent>
    </Card>
  );
}
