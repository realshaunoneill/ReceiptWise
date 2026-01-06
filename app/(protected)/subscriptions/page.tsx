'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navigation } from '@/components/layout/navigation';
import { useSubscriptions } from '@/hooks/use-subscriptions';
import { useUser } from '@/lib/hooks/use-user';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreateSubscriptionDialog } from '@/components/subscriptions/create-subscription-dialog';
import { SubscriptionDetailModal } from '@/components/subscriptions/subscription-detail-modal';
import { SubscriptionStats } from '@/components/subscriptions/subscription-stats';
import { SubscriptionList } from '@/components/subscriptions/subscription-list';
import { UpcomingSubscriptionCard } from '@/components/subscriptions/upcoming-subscription-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Loader2, Calendar, AlertCircle, Crown, Check, CreditCard, Bell, PieChart, ArrowRight, Sparkles } from 'lucide-react';
import { addDays } from 'date-fns';
import { Button } from '@/components/ui/button';

type Status = 'active' | 'paused' | 'cancelled' | undefined;

const trialDays = process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS ? parseInt(process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS) : 0;

function SubscriptionsPageContent() {
  const [statusFilter, setStatusFilter] = useState<Status>('active');
  const { data: subscriptions, isLoading } = useSubscriptions(undefined, statusFilter, true);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSubscribed, isLoading: userLoading } = useUser();

  const handleUpgradeClick = () => {
    router.push('/upgrade');
  };

  // Handle selected and filter query parameters from URL
  useEffect(() => {
    const selected = searchParams.get('selected');
    const filter = searchParams.get('filter');
    if (selected) {
      setSelectedSubscriptionId(selected);
    }
    if (filter === 'missing') {
      setShowMissingOnly(true);
    }
  }, [searchParams]);

  // Calculate stats
  const activeSubscriptions = subscriptions?.filter(s => s.status === 'active') || [];

  // Get upcoming payments
  const now = new Date();
  const futureDate = addDays(now, 7);

  // Get next 3 upcoming payments (showing all upcoming, highlighting those within 7 days)
  const upcomingPayments = activeSubscriptions
    .filter(sub => sub.nextBillingDate)
    .sort((a, b) => {
      const dateA = new Date(a.nextBillingDate!).getTime();
      const dateB = new Date(b.nextBillingDate!).getTime();
      return dateA - dateB;
    })
    .slice(0, 3); // Top 3 upcoming payments

  // Check how many are within 7 days
  const upcomingWithin7Days = upcomingPayments.filter(sub => {
    const billingDate = new Date(sub.nextBillingDate!);
    return billingDate >= now && billingDate <= futureDate;
  }).length;

  const totalMonthly = activeSubscriptions.reduce((sum, sub) => {
    const amount = parseFloat(sub.amount);
    if (sub.billingFrequency === 'monthly') return sum + amount;
    if (sub.billingFrequency === 'quarterly') return sum + (amount / 3);
    if (sub.billingFrequency === 'yearly') return sum + (amount / 12);
    if (sub.billingFrequency === 'custom' && sub.customFrequencyDays) {
      return sum + (amount / sub.customFrequencyDays * 30);
    }
    return sum;
  }, 0);

  const totalYearly = totalMonthly * 12;
  const missingPaymentsCount = subscriptions?.reduce((sum, sub) => sum + (sub.missingPayments || 0), 0) || 0;

  // Filter subscriptions with missing payments
  const subscriptionsWithMissing = subscriptions?.filter(sub => (sub.missingPayments || 0) > 0) || [];
  const displaySubscriptions = showMissingOnly ? subscriptionsWithMissing : subscriptions;

  // Show loading state
  if (userLoading) {
    return (
      <>
        <Navigation />
        <main className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
          <div className="flex h-[400px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      </>
    );
  }

  // Show paywall for non-subscribed users
  if (!isSubscribed) {
    return (
      <>
        <Navigation />
        <main className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Subscriptions</h1>
              <p className="mt-1 text-sm text-muted-foreground sm:mt-2">Track and manage your recurring expenses</p>
            </div>
          </div>

          {/* Premium Upsell Card */}
          <Card className="border-2 border-primary/20 bg-linear-to-br from-primary/5 via-transparent to-primary/5">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Crown className="h-8 w-8 text-primary" />
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <CardTitle className="text-2xl text-foreground">Unlock Subscription Tracking</CardTitle>
                {trialDays > 0 && (
                  <Badge variant="default" className="text-xs">
                    {trialDays}-day free trial
                  </Badge>
                )}
              </div>
              <CardDescription className="text-base max-w-lg mx-auto">
                Never miss a payment again. Track all your recurring expenses in one place and get smart insights on your subscriptions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Features Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 mb-3">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1 text-foreground">Track Subscriptions</h3>
                  <p className="text-sm text-muted-foreground">
                    Add all your recurring payments
                  </p>
                </div>
                <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 mb-3">
                    <Bell className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1 text-foreground">Payment Reminders</h3>
                  <p className="text-sm text-muted-foreground">
                    Never miss a due date
                  </p>
                </div>
                <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 mb-3">
                    <PieChart className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1 text-foreground">Cost Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    See monthly & yearly totals
                  </p>
                </div>
                <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 mb-3">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1 text-foreground">Receipt Matching</h3>
                  <p className="text-sm text-muted-foreground">
                    Link receipts to subscriptions
                  </p>
                </div>
              </div>

              {/* Benefits List */}
              <div className="rounded-lg border bg-card p-6">
                <h3 className="font-semibold mb-4 text-foreground">What's included with Premium:</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    'Unlimited subscription tracking',
                    'Payment due date reminders',
                    'Monthly & yearly cost overview',
                    'Missing payment detection',
                    'Receipt-to-subscription linking',
                    'Pause & resume subscriptions',
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
                  <Sparkles className="h-5 w-5" />
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
        </main>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <main className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Subscriptions</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-2">Track and manage your recurring expenses</p>
          </div>
          <CreateSubscriptionDialog />
        </div>

      {/* Empty State - No Subscriptions */}
      {!isLoading && (!subscriptions || subscriptions.length === 0) && (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2 text-foreground">No subscriptions yet</h3>
          <p className="text-muted-foreground mb-4">Start tracking your recurring payments</p>
          <CreateSubscriptionDialog />
        </div>
      )}

      {/* Stats Grid */}
      {subscriptions && subscriptions.length > 0 && (
        <div className="mb-6">
          <SubscriptionStats
            activeCount={activeSubscriptions.length}
            monthlyTotal={totalMonthly}
            yearlyTotal={totalYearly}
            missingPayments={missingPaymentsCount}
            onMissingPaymentsClick={() => {
              setShowMissingOnly(true);
              setStatusFilter('active');
              const params = new URLSearchParams(searchParams.toString());
              params.set('filter', 'missing');
              router.push(`/subscriptions?${params.toString()}`);
            }}
          />
        </div>
      )}

      {/* Missing Payments Filter Banner */}
      {showMissingOnly && subscriptionsWithMissing.length > 0 && (
        <div className="mb-6 rounded-lg border border-orange-500/50 bg-orange-500/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <div>
                <h3 className="font-semibold text-orange-900 dark:text-orange-100">
                  Subscriptions Missing Receipts
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  {subscriptionsWithMissing.length} subscription{subscriptionsWithMissing.length !== 1 ? 's' : ''} with {missingPaymentsCount} missing payment{missingPaymentsCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowMissingOnly(false);
                const params = new URLSearchParams(searchParams.toString());
                params.delete('filter');
                router.push(`/subscriptions${params.toString() ? '?' + params.toString() : ''}`);
              }}
            >
              Show All
            </Button>
          </div>
        </div>
      )}

      {/* Upcoming Payments Section */}
      {subscriptions && subscriptions.length > 0 && upcomingPayments.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Upcoming Payments</h2>
            {upcomingWithin7Days > 0 && (
              <span className="text-sm text-muted-foreground">
                • {upcomingWithin7Days} in next 7 days
              </span>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingPayments.map((subscription) => (
              <UpcomingSubscriptionCard
                key={subscription.id}
                subscription={subscription}
                onClick={() => setSelectedSubscriptionId(subscription.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      {subscriptions && subscriptions.length > 0 && (
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as Status)} className="w-full">
          <TabsList className="grid w-full md:w-auto grid-cols-3">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="paused">Paused</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>

          <TabsContent value={statusFilter || 'active'} className="mt-6">
            <SubscriptionList
              subscriptions={displaySubscriptions}
              isLoading={isLoading}
              status={statusFilter || 'active'}
              onSelectSubscription={setSelectedSubscriptionId}
            />
          </TabsContent>
        </Tabs>
      )}

        {/* Detail Modal */}
        <SubscriptionDetailModal
          subscriptionId={selectedSubscriptionId}
          open={!!selectedSubscriptionId}
          onOpenChange={(open) => !open && setSelectedSubscriptionId(null)}
        />
      </main>
    </>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <SubscriptionsPageContent />
    </Suspense>
  );
}

