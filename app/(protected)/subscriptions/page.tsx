'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Calendar, AlertCircle, Crown, Check, CreditCard, PieChart, ArrowRight, Loader2 } from 'lucide-react';
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

  // Show skeleton loading state
  if (userLoading) {
    return (
      <main className="container mx-auto p-6 max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Skeleton className="h-8 sm:h-9 w-48" />
            <Skeleton className="h-4 w-72 mt-1 sm:mt-2" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24 mb-1" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-6 w-40" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-lg border">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="text-right space-y-1">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <div className="flex gap-4">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    );
  }

  // Show paywall for non-subscribed users
  if (!isSubscribed) {
    return (
      <main className="container mx-auto p-6 max-w-7xl" aria-labelledby="subscriptions-title">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
            <div>
              <h1 id="subscriptions-title" className="text-3xl font-bold text-foreground">Subscriptions</h1>
              <p className="text-muted-foreground">Recurring payments, what they cost, and what is due next.</p>
            </div>
          </div>

          {/*
            Premium upsell.

            This promised "Payment Reminders — never miss a due date" and, in the
            list below it, "Payment due date reminders". Nothing in this codebase
            sends anything: there is no mail provider, no push, no scheduled
            notification of any kind. What the product does is *show* what is due
            next when you open the page, which is a different promise and is the
            one now being made. "Smart insights" and "never miss a payment again"
            have gone the same way.
          */}
          <Card className="border-primary/30">
            <CardHeader className="pb-4">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <Crown className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-2xl text-foreground">Subscription tracking is part of Premium</CardTitle>
                {trialDays > 0 && (
                  <Badge variant="secondary">{trialDays}-day trial</Badge>
                )}
              </div>
              <CardDescription className="max-w-xl text-base">
                Every recurring payment in one list, with what it costs you a month and a
                year, and what is due next.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    icon: CreditCard,
                    title: 'One list',
                    body: 'Every recurring payment, however you pay it.',
                  },
                  {
                    icon: Calendar,
                    title: 'What is due next',
                    body: 'Upcoming payments, shown when you open the page.',
                  },
                  {
                    icon: PieChart,
                    title: 'What it adds up to',
                    body: 'Monthly and yearly totals across the household.',
                  },
                  {
                    icon: Check,
                    title: 'Matched to receipts',
                    body: 'Link the receipt that proves a payment went out.',
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
                    'Unlimited subscriptions',
                    'Shared across the household',
                    'Missing payment detection',
                    'Pause and resume',
                    'Unlimited receipts and scanning',
                    'CSV and JSON export',
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
      </main>
    );
  }

  return (
    <main className="container mx-auto p-6 max-w-7xl" aria-labelledby="subscriptions-main-title">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 id="subscriptions-main-title" className="text-3xl font-bold text-foreground">Subscriptions</h1>
          <p className="text-muted-foreground">Recurring payments, what they cost, and what is due next.</p>
        </div>
        <CreateSubscriptionDialog />
      </div>

      {/* Empty State - No Subscriptions */}
      {!isLoading && (!subscriptions || subscriptions.length === 0) && (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
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
        <div className="mb-6 rounded-lg border border-warning/40 bg-warning/8 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-warning" aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-warning">
                  Subscriptions Missing Receipts
                </h3>
                <p className="text-sm text-muted-foreground">
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
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={
      <main className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
        <span className="sr-only">Loading subscriptions...</span>
      </main>
    }>
      <SubscriptionsPageContent />
    </Suspense>
  );
}
