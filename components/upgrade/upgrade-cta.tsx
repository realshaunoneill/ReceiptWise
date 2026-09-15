'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';

const pricingDetails = {
  trial: process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS ? parseInt(process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS) : 0,
};

export function UpgradeCTA() {
  const upgradeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        if (pricingDetails.trial > 0) {
          toast.success(`Starting your ${pricingDetails.trial}-day free trial...`);
        }
        window.location.href = data.url;
      }
    },
    onError: (error) => {
      console.error('Error creating checkout session:', error);
      toast.error('Failed to start checkout. Please try again.');
    },
  });

  const handleUpgrade = () => {
    upgradeMutation.mutate();
  };

  return (
    /* Was a sparkles medallion over "Ready to get started?" — the second
       identically-shaped CTA on the page, decorated rather than written. */
    <Card className="border-primary/25 bg-primary/5">
      <CardContent className="flex flex-col items-start gap-6 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
            {pricingDetails.trial > 0
              ? 'Try it on this week’s receipts'
              : 'Ready when you are'}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {pricingDetails.trial > 0
              ? `${pricingDetails.trial} days, no charge if you cancel before they are up. Long enough to know whether it earns its keep.`
              : 'Billed monthly or annually, cancel any time.'}
          </p>
        </div>
        <Button
          onClick={handleUpgrade}
          disabled={upgradeMutation.isPending}
          size="lg"
          className="shrink-0 gap-2"
        >
          {upgradeMutation.isPending ? (
            'One moment…'
          ) : (
            <>
              {pricingDetails.trial > 0 ? 'Start the trial' : 'Subscribe'}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
