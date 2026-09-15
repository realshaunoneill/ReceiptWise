'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, ArrowRight, Upload, Users, BarChart3, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/lib/hooks/use-user';

interface SubscriptionGateProps {
  feature: 'upload' | 'sharing' | 'analytics';
  title?: string;
  description?: string;
  children?: React.ReactNode;
  variant?: 'full' | 'inline';
}

const featureConfig = {
  upload: {
    icon: Upload,
    title: 'Receipt Upload',
    description: 'Upload and process new receipts with AI-powered data extraction',
    benefits: [
      'Unlimited receipt uploads',
      'AI-powered OCR extraction',
      'Smart categorization',
      'Cloud storage & sync',
    ],
  },
  sharing: {
    icon: Users,
    title: 'Household Sharing',
    description: 'Create households and share receipts with family members',
    benefits: [
      'Unlimited households',
      'Member management',
      'Real-time collaboration',
      'Shared expense tracking',
    ],
  },
  analytics: {
    icon: BarChart3,
    title: 'Advanced Analytics',
    description: 'Get detailed insights and spending analysis',
    benefits: [
      'Advanced charts & graphs',
      'Spending trends analysis',
      'Category breakdowns',
      'Export capabilities',
    ],
  },
};

export function SubscriptionGate({
  feature,
  title,
  description,
  children,
  variant = 'full',
}: SubscriptionGateProps) {
  const router = useRouter();
  const { user, isSubscribed, isLoading } = useUser();

  // If user is subscribed, render children normally
  if (isSubscribed) {
    return <>{children}</>;
  }

  // If user data is loading, show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If user data failed to load, render children (fail open for better UX)
  if (!user) {
    return <>{children}</>;
  }

  const config = featureConfig[feature];
  const FeatureIcon = config.icon;
  const trialDays = process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS
    ? parseInt(process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS)
    : 0;

  const handleSubscribe = () => {
    router.push('/upgrade');
  };

  // Inline variant - compact upgrade button
  if (variant === 'inline') {
    return (
      <Button onClick={handleSubscribe} className="gap-2" variant="default">
        <Crown className="h-4 w-4" />
        Upgrade to Create
      </Button>
    );
  }

  // Full variant - complete card
  return (
    <div className="flex items-center justify-center p-8">
      <Card className="max-w-lg w-full border-dashed">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <FeatureIcon className="h-6 w-6 text-primary" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <CardTitle className="text-xl">{title || config.title}</CardTitle>
            {trialDays > 0 && (
              <Badge variant="secondary" className="text-xs">
                {trialDays}-day free trial
              </Badge>
            )}
          </div>
          <CardDescription>{description || config.description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-2">
            {config.benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-3 w-3 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-2 pt-2">
            <Button onClick={handleSubscribe} className="w-full gap-2 sm:w-auto">
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
    </div>
  );
}
