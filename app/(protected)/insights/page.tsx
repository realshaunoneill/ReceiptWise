'use client';

import { useState } from 'react';
import { SpendingSummaryCard } from '@/components/insights/spending-summary-card';
import { TopItemsList } from '@/components/insights/top-items-list';
import { ItemSearchAnalysis } from '@/components/insights/item-search-analysis';
import { SubscriptionInsights } from '@/components/insights/subscription-insights';
import { HouseholdSelector } from '@/components/households/household-selector';
import { useUser } from '@/lib/hooks/use-user';
import { useHouseholds } from '@/lib/hooks/use-households';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Search, CreditCard, Crown, Check, PieChart, ScanLine, ArrowRight, LineChart } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter } from 'next/navigation';
import { useTrialDays } from '@/lib/hooks/use-trial-days';

export default function InsightsPage() {
  const trialDays = useTrialDays();
  const router = useRouter();
  const { isLoading, isSubscribed } = useUser();
  const { data: households = [] } = useHouseholds();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>();
  const [activeTab, setActiveTab] = useState('overview');

  // Determine view mode based on selection
  const isPersonalOnly = selectedHouseholdId === 'personal';
  const actualHouseholdId = isPersonalOnly ? undefined : selectedHouseholdId;

  return (
    <main className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6" aria-labelledby="insights-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 id="insights-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Insights
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-2">
              What you spend on, what you buy most, and what the subscriptions cost.
            </p>
          </div>

          {isSubscribed && (
            <HouseholdSelector
              households={[
                { id: '', name: 'All Receipts' },
                { id: 'personal', name: 'Personal Only' },
                ...households,
              ]}
              selectedHouseholdId={selectedHouseholdId || ''}
              onSelect={(id) => setSelectedHouseholdId(id || undefined)}
            />
          )}
        </div>

        {isLoading ? (
          <div className="space-y-6">
            {/* Tabs - matches loading.tsx */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
              <Skeleton className="h-9 w-24 rounded-md" />
              <Skeleton className="h-9 w-24 rounded-md" />
              <Skeleton className="h-9 w-32 rounded-md" />
            </div>
            {/* Main Content Grid - matches loading.tsx */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Spending Summary Card */}
              <Card className="lg:row-span-2">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-6 w-40" />
                  </div>
                  <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Period Selector */}
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-8 w-28" />
                    </div>
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-24" />
                    </div>
                  </div>
                  {/* Category Breakdown */}
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-32" />
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              {/* Top Items Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <Skeleton className="h-6 w-32" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                  <Skeleton className="h-4 w-56" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </CardContent>
              </Card>
              {/* Item search moved to its own tab, so Overview is two panels. */}
            </div>
          </div>
        ) : !isSubscribed ? (
          /*
            Upsell for unsubscribed users.

            The old version was headed "Unlock AI-Powered Insights" over a
            sparkles medallion, and promised "hidden patterns", "intelligent
            analytics" and "personalized recommendations" — the last of which the
            product does not do at all. Overclaiming on the paywall is the worst
            possible place to do it: it is the page people read immediately before
            deciding whether to trust you with a card number.
          */
          <Card className="border-primary/30">
            <CardHeader className="pb-4">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <LineChart className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-2xl text-foreground">Insights are part of Premium</CardTitle>
                {trialDays > 0 && (
                  <Badge variant="secondary">{trialDays}-day trial</Badge>
                )}
              </div>
              <CardDescription className="max-w-xl text-base">
                Once there are receipts to read, this page breaks down where the money went
                and what you buy most often.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    icon: ScanLine,
                    title: 'Written summary',
                    body: 'A plain-language read on the period you pick.',
                  },
                  {
                    icon: TrendingUp,
                    title: 'Trends',
                    body: 'Week, month or year, so you can see the direction.',
                  },
                  {
                    icon: PieChart,
                    title: 'Categories',
                    body: 'Which categories the total is actually made of.',
                  },
                  {
                    icon: Search,
                    title: 'Item history',
                    body: 'Every time you bought a thing, and what it cost.',
                  },
                ].map(({ icon: Icon, title, body }) => (
                  <div key={title}>
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                    <h3 className="mt-3 font-semibold text-foreground">{title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>

              {/* Benefits List */}
              <div className="rounded-lg border bg-muted/30 p-6">
                <h3 className="mb-4 font-semibold text-foreground">Also included</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    'Unlimited receipts and scanning',
                    'Unlimited households',
                    'Subscription tracking',
                    'Filter by household or personal',
                  ].map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="space-y-3 border-t pt-6">
                <Button onClick={() => router.push('/upgrade')} size="lg" className="gap-2">
                  <Crown className="h-4 w-4" aria-hidden="true" />
                  {trialDays > 0 ? `Start the ${trialDays}-day trial` : 'See Premium'}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <p className="text-sm text-muted-foreground">
                  {trialDays > 0
                    ? `Cancel any time in the ${trialDays} days and you are not charged.`
                    : 'Cancel any time.'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          /*
            Three tabs, each panel appearing in exactly one of them.

            There were four tabs before and every panel was in two of them: the
            spending summary sat in both Overview and "AI Summary", the top-items
            list in both Overview and "Top Items", the item search in two, the
            subscription strip in two. Switching tabs largely re-showed what you
            were already looking at, so the tabs taught the user nothing about
            where anything lives. The "AI Summary" tab is gone — the summary is
            one of the things Overview is for, and naming a tab after the
            technology behind it was never useful to the person reading it.
          */
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
              <TabsTrigger value="overview" className="gap-2">
                <TrendingUp className="hidden h-4 w-4 sm:block" aria-hidden="true" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="items" className="gap-2">
                <Search className="hidden h-4 w-4 sm:block" aria-hidden="true" />
                Items
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="gap-2">
                <CreditCard className="hidden h-4 w-4 sm:block" aria-hidden="true" />
                Subscriptions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <SpendingSummaryCard householdId={actualHouseholdId} autoLoad />
                <TopItemsList householdId={actualHouseholdId} autoLoad />
              </div>
            </TabsContent>

            <TabsContent value="items" className="mt-6 space-y-6">
              <ItemSearchAnalysis householdId={actualHouseholdId} />
            </TabsContent>

            <TabsContent value="subscriptions" className="mt-6 space-y-6">
              <SubscriptionInsights />
            </TabsContent>
          </Tabs>
        )}
      </main>
  );
}
