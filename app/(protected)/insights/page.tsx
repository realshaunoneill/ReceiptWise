'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation } from '@/components/layout/navigation';
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
import { Loader2, Sparkles, TrendingUp, Search, CreditCard, Crown, Check, PieChart, Brain, ArrowRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const trialDays = process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS ? parseInt(process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS) : 0;

export default function InsightsPage() {
  const { isLoading, isSubscribed } = useUser();
  const { data: households = [] } = useHouseholds();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>();
  const [activeTab, setActiveTab] = useState('overview');
  const router = useRouter();

  const handleUpgradeClick = () => {
    router.push('/upgrade');
  };

  // Determine view mode based on selection
  const isPersonalOnly = selectedHouseholdId === 'personal';
  const actualHouseholdId = isPersonalOnly ? undefined : selectedHouseholdId;

  return (
    <>
      <Navigation />
      <main className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Spending Insights
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-2">
              AI-powered analysis of your spending patterns and top purchases
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
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !isSubscribed ? (
          <Card className="border-2 border-primary/20 bg-linear-to-br from-primary/5 via-transparent to-primary/5">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <CardTitle className="text-2xl text-foreground">Unlock AI-Powered Insights</CardTitle>
                {trialDays > 0 && (
                  <Badge variant="default" className="text-xs">
                    {trialDays}-day free trial
                  </Badge>
                )}
              </div>
              <CardDescription className="text-base max-w-lg mx-auto">
                Discover hidden patterns in your spending with intelligent analytics and personalized recommendations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Features Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 mb-3">
                    <Brain className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1 text-foreground">AI Summaries</h3>
                  <p className="text-sm text-muted-foreground">
                    Smart spending analysis
                  </p>
                </div>
                <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 mb-3">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1 text-foreground">Trend Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Track spending over time
                  </p>
                </div>
                <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 mb-3">
                    <PieChart className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1 text-foreground">Category Breakdown</h3>
                  <p className="text-sm text-muted-foreground">
                    See where money goes
                  </p>
                </div>
                <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 mb-3">
                    <Search className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1 text-foreground">Item Search</h3>
                  <p className="text-sm text-muted-foreground">
                    Find any purchase fast
                  </p>
                </div>
              </div>

              {/* Benefits List */}
              <div className="rounded-lg border bg-card p-6">
                <h3 className="font-semibold mb-4 text-foreground">What you'll discover:</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    'AI-powered spending summaries',
                    'Top items and purchase trends',
                    'Advanced item search and analysis',
                    'Subscription cost overview',
                    'Category spending breakdown',
                    'Household expense filtering',
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="text-center space-y-4 pt-4 border-t">
                <Button
                  onClick={handleUpgradeClick}
                  size="lg"
                  className="gap-2 text-base h-12 px-8"
                >
                  <Crown className="h-5 w-5" />
                  {trialDays > 0 ? `Start ${trialDays}-Day Free Trial` : 'Upgrade to Premium'}
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <p className="text-sm text-muted-foreground">
                  {trialDays > 0
                    ? `Try free for ${trialDays} days. Cancel anytime, no questions asked.`
                    : 'Cancel anytime. No long-term contracts.'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
              <TabsTrigger value="overview" className="gap-2">
                <TrendingUp className="h-4 w-4 hidden sm:block" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="ai-summary" className="gap-2">
                <Sparkles className="h-4 w-4 hidden sm:block" />
                AI Summary
              </TabsTrigger>
              <TabsTrigger value="top-items" className="gap-2">
                <Search className="h-4 w-4 hidden sm:block" />
                Top Items
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="gap-2">
                <CreditCard className="h-4 w-4 hidden sm:block" />
                Subscriptions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-6">
              <SubscriptionInsights />
              <div className="grid gap-6 lg:grid-cols-2">
                <SpendingSummaryCard householdId={actualHouseholdId} autoLoad />
                <TopItemsList householdId={actualHouseholdId} autoLoad />
              </div>
            </TabsContent>

            <TabsContent value="ai-summary" className="space-y-6 mt-6">
              <SpendingSummaryCard householdId={actualHouseholdId} autoLoad />
              <ItemSearchAnalysis householdId={actualHouseholdId} />
            </TabsContent>

            <TabsContent value="top-items" className="space-y-6 mt-6">
              <TopItemsList householdId={actualHouseholdId} autoLoad />
              <ItemSearchAnalysis householdId={actualHouseholdId} />
            </TabsContent>

            <TabsContent value="subscriptions" className="space-y-6 mt-6">
              <SubscriptionInsights />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </>
  );
}
