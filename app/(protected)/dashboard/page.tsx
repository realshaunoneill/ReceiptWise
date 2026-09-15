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
import { Upload, Receipt, ArrowRight, PieChart, Crown, Check, Chrome } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { categoryBadgeClasses, getCategory } from '@/lib/utils/categories';
import { useRouter } from 'next/navigation';
import { UpcomingPayments } from '@/components/subscriptions/upcoming-payments';
import { useSubscriptions } from '@/hooks/use-subscriptions';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>();
  const router = useRouter();

  const { data: households = [] } = useHouseholds();
  const { data: subscriptions = [] } = useSubscriptions(undefined, 'active', false);
  const { isSubscribed } = useUser();

  // Determine view mode based on selection
  const isPersonalOnly = selectedHouseholdId === 'personal';
  const actualHouseholdId = isPersonalOnly ? undefined : selectedHouseholdId;

  const { stats, isLoading: statsLoading } = useDashboardStats(actualHouseholdId, isPersonalOnly);

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                { id: '', name: 'All Receipts' },
                { id: 'personal', name: 'Personal Only' },
                ...households,
              ]}
              selectedHouseholdId={selectedHouseholdId || ''}
              onSelect={(id) => setSelectedHouseholdId(id || undefined)}
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

            {/* Category Breakdown */}
            {stats?.spendingByCategory && stats.spendingByCategory.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      <CardTitle className="text-lg">Spending by category</CardTitle>
                    </div>
                    <Link href="/insights">
                      {/* Was "✨ View AI Insights". The page is called Insights;
                          badging the link with sparkles and the word AI advertises
                          the implementation rather than the destination. */}
                      <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                        All insights
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {stats.spendingByCategory.slice(0, 6).map((category) => (
                      <div
                        key={category.category}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={categoryBadgeClasses(category.category)}>
                            {getCategory(category.category).label}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="amount font-semibold">{category.percentage}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {subscriptions.length > 0 && (
          <UpcomingPayments subscriptions={subscriptions} daysAhead={7} />
        )}

        {stats?.recentReceipts && stats.recentReceipts.length > 0 && (
          <div>
            <h2 className="mb-4 text-xl font-semibold">Recent receipts</h2>
            <ReceiptList receipts={stats.recentReceipts} />
          </div>
        )}

        {/*
          Empty state.
          It used to restate the three-step "1. Upload → 2. AI Processing →
          3. Track Spending" explainer that the marketing site and the onboarding
          tour both already give — the third time a new user is told how the
          product works, on the screen where they want to start using it. It is now
          one instruction and one button, with the extension tip demoted to a note.
        */}
        {(!stats || stats.totalReceipts === 0) && (
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
                    {['Unlimited receipts', 'Household sharing', 'Spending insights'].map((item) => (
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

              {/* Chrome Extension note. Was a hardcoded blue-50/blue-950 panel
                  labelled "Pro Tip:" — off the palette in both themes. */}
              <Alert variant="info">
                <Chrome className="h-4 w-4" aria-hidden="true" />
                <AlertTitle>Receipts that never get printed</AlertTitle>
                <AlertDescription>
                  The Chrome extension clips receipts straight off a web page. Set it up in
                  Settings → Integrations.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}
      </main>
  );
}
