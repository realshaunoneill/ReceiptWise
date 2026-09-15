'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UpgradeHero } from '@/components/upgrade/upgrade-hero';
import { PricingCard } from '@/components/upgrade/pricing-card';
import { ComparisonTable } from '@/components/upgrade/comparison-table';
import { UpgradeCTA } from '@/components/upgrade/upgrade-cta';
import { UpgradeSkeleton } from '@/components/upgrade/upgrade-skeleton';
import { useUser } from '@/lib/hooks/use-user';

export default function UpgradePage() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const isSubscribed = user?.subscribed ?? false;

  useEffect(() => {
    if (!isLoading && isSubscribed) {
      router.replace('/dashboard');
    }
  }, [isLoading, isSubscribed, router]);

  // Show skeleton loading state while checking subscription
  if (isLoading) {
    return <UpgradeSkeleton />;
  }

  // If subscribed, show nothing while redirecting
  if (isSubscribed) {
    return null;
  }

  return (
    <main className="container mx-auto max-w-4xl space-y-16 px-4 py-12" aria-labelledby="upgrade-title">
      <UpgradeHero />
      <PricingCard />
      <ComparisonTable />
      <UpgradeCTA />
    </main>
  );
}
