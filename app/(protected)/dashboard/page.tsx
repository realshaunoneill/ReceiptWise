'use client';

import { useState } from 'react';
import { QuickStats } from '@/components/insights/quick-stats';
import { SpendingSummary } from '@/components/insights/spending-summary';
import { SpendingChart } from '@/components/insights/spending-chart';
import { ReceiptList } from '@/components/receipts/receipt-list';
import { HouseholdSelector } from '@/components/households/household-selector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardStats } from '@/lib/hooks/use-dashboard-stats';
import { useHouseholds } from '@/lib/hooks/use-households';
import { useUser } from '@/lib/hooks/use-user';
import { Upload, Receipt, ArrowRight, Crown, Check, RotateCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useRouter } from 'next/navigation';
import { UpcomingPayments } from '@/components/subscriptions/upcoming-payments';
import { PlanCard } from '@/components/dashboard/plan-card';
import { useSubscriptions } from '@/hooks/use-subscriptions';

export default function DashboardPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>();
  const router = useRouter();

  const { data: households = [] } = useHouseholds();
  const { isSubscribed, entitlements } = useUser();

  // Determine view mode based on selection
  const isPersonalOnly = selectedHouseholdId === 'personal';
  const actualHouseholdId = isPersonalOnly ? undefined : selectedHouseholdId;
  const selectedHousehold = households.find((household: { id: string; name: string }) => household.id === actualHouseholdId);

  // The plan and the bills on the way follow the household picked above. A member without Premium
  // of their own, in a household another member pays for, sees that household's: their personal
  // scope is empty, and the card used to tell them to "add your pay and bills" while the shared
  // bills they're entitled to went unshown.
  const coveredHouseholdId = entitlements && !entitlements.personal ? entitlements.householdIds[0] : undefined;
  const financeHouseholdId = actualHouseholdId ?? coveredHouseholdId;
  const { data: subscriptions = [] } = useSubscriptions(financeHouseholdId, 'active', false);

  const { stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats(actualHouseholdId, isPersonalOnly);

  // Show skeleton loading state
  if (statsLoading) {
    return (
      <main className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-2">Where the money went, and what has come in lately.</p>
          </div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20 mb-1" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-9 w-32" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[200px] w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    );
  }

  const quickStats = stats ? {
    totalReceipts: stats.totalReceipts,
    totalItems: stats.totalItems,
    avgSpending: stats.avgSpending,
    topCategory: stats.topCategory,
  } : {
    totalReceipts: 0,
    totalItems: 0,
    avgSpending: 0,
    topCategory: 'No data',
  };

  return (
    <main className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6" aria-labelledby="dashboard-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 id="dashboard-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-2">Where the money went, and what has come in lately.</p>
          </div>

          <div className="flex items-center gap-4">
            <HouseholdSelector
              households={[
                { id: '', name: 'Everything' },
                { id: 'personal', name: 'Just mine' },
                ...households,
              ]}
              selectedHouseholdId={selectedHouseholdId || ''}
              onSelect={(id) => setSelectedHouseholdId(id || undefined)}
              label="Show"
            />
          </div>
        </div>

        {/* Quick Stats - show for subscribed users with receipts */}
        {isSubscribed && stats && stats.totalReceipts > 0 && (
          <>
            <QuickStats stats={quickStats} />

            <div className="grid gap-6 lg:grid-cols-2">
              <SpendingSummary
                period={period}
                onPeriodChange={setPeriod}
                householdId={actualHouseholdId}
                personalOnly={isPersonalOnly}
              />
              <SpendingChart
                period={period}
                householdId={actualHouseholdId}
                personalOnly={isPersonalOnly}
              />
            </div>
            {/* A "Spending by category" card of percentages sat here, directly under the
                summary's own euro breakdown by category: the same split twice. */}
          </>
        )}

        {statsError && (
          <Alert variant="destructive">
            <AlertTitle>Your dashboard didn&apos;t load</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              Your receipts are safe; this is a problem fetching them.
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => refetchStats()}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <PlanCard householdId={financeHouseholdId} />

        {subscriptions.length > 0 && (
          <UpcomingPayments subscriptions={subscriptions} daysAhead={7} />
        )}

        {stats?.recentReceipts && stats.recentReceipts.length > 0 && (
          // The list card has its own "Recent receipts" title; a heading of the same name sat above it.
          <ReceiptList receipts={stats.recentReceipts} />
        )}

        {/*
          Empty state.
          It used to restate the three-step "1. Upload → 2. AI Processing →
          3. Track Spending" explainer that the marketing site and the onboarding
          tour both already give — the third time a new user is told how the
          product works, on the screen where they want to start using it. It is now
          one instruction and one button, with the extension tip demoted to a note.
        */}
        {!statsError && (!stats || stats.totalReceipts === 0) && selectedHousehold && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Nothing shared with {selectedHousehold.name} yet</CardTitle>
              <CardDescription>
                Receipts appear here once someone shares one with the household, from its detail view or as it&apos;s uploaded.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {!statsError && (!stats || stats.totalReceipts === 0) && !selectedHousehold && (
          <Card className="border-dashed">
            <CardHeader className="pb-4">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <Receipt className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <CardTitle className="text-xl text-foreground">No receipts yet</CardTitle>
              <CardDescription className="text-base">
                {isSubscribed
                  ? 'Add one and this page fills in — totals, categories and the week’s trend.'
                  : 'Your dashboard fills in as soon as there is something to read. Uploading needs a subscription.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isSubscribed ? (
                <Button onClick={() => router.push('/receipts')} className="gap-2">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Add your first receipt
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                    {['Unlimited receipts', 'Households of your own', 'Spending insights'].map((item) => (
                      <span key={item} className="flex items-center gap-1.5 text-muted-foreground">
                        <Check className="h-4 w-4 text-primary" aria-hidden="true" />
                        {item}
                      </span>
                    ))}
                  </div>
                  <Button onClick={() => router.push('/upgrade')} className="gap-2">
                    <Crown className="h-4 w-4" aria-hidden="true" />
                    See what Premium includes
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )}

              {/* A Chrome extension note was here, saying to set it up in Settings. It isn't on
                  the Chrome Web Store yet, so it was a step nobody could take. */}
            </CardContent>
          </Card>
        )}
      </main>
  );
}
