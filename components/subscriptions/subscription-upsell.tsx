'use client';

import { useRouter } from 'next/navigation';
import { Crown, Check, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SubscriptionUpsellProps {
  title?: string;
  description?: string;
  features?: string[];
  className?: string;
  variant?: 'default' | 'compact' | 'minimal';
}

export function SubscriptionUpsell({
  title = 'This is part of Premium',
  description = 'One subscription covers everything the app can do',
  features = [
    'Unlimited receipts, all of them read for you',
    'Unlimited households',
    'Spending analytics and insights',
    'Subscription tracking',
    'Priority support',
  ],
  className = '',
  variant = 'default',
}: SubscriptionUpsellProps) {
  const router = useRouter();

  const handleUpgrade = () => {
    router.push('/upgrade');
  };

  const trialDays = process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS
    ? parseInt(process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS)
    : 0;

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <Crown className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button onClick={handleUpgrade} size="sm" className="shrink-0 gap-1.5">
          See Premium
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <Card className={`border-dashed ${className}`}>
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <Button onClick={handleUpgrade} size="sm" className="shrink-0 gap-1.5">
            See Premium
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-dashed ${className}`}>
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Crown className="h-6 w-6 text-primary" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-1">
          <CardTitle className="text-xl">{title}</CardTitle>
          {trialDays > 0 && (
            <Badge variant="secondary">{trialDays}-day trial</Badge>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-2">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-3 w-3 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">{feature}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2 pt-2">
          <Button onClick={handleUpgrade} className="w-full gap-2 sm:w-auto">
            <Crown className="h-4 w-4" aria-hidden="true" />
            {trialDays > 0 ? `Start the ${trialDays}-day trial` : 'See Premium'}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          {trialDays > 0 && (
            <p className="text-xs text-muted-foreground">
              Cancel during the trial and nothing is charged.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
