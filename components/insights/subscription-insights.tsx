'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSubscriptions } from '@/hooks/use-subscriptions';
import { useCurrency } from '@/lib/hooks/use-currency';
import { Loader2, TrendingUp, Calendar, Coins, AlertCircle, ArrowRight } from 'lucide-react';
import { daysBetween, formatLocalDate, fromUtcDate, localToday } from '@/lib/dates/local-date';
import { monthlyEquivalent } from '@/lib/schedule/billing-schedule';
import { formatCurrency } from '@/lib/utils/currency';
import { formatTotals, totalsByCurrency } from '@/lib/utils/currency-totals';
import { cn } from '@/lib/utils';
import { urgencySurfaceClass } from '@/lib/utils/urgency';
import Link from 'next/link';

export function SubscriptionInsights() {
  const { data: subscriptions, isLoading } = useSubscriptions(undefined, 'active', true);
  const { currency: userCurrency } = useCurrency();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Subscription Insights
          </CardTitle>
          <CardDescription>
            Overview of your recurring expenses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeSubscriptions = subscriptions?.filter(s => s.status === 'active') || [];
  const monthlyOf = (sub: (typeof activeSubscriptions)[number]) =>
    monthlyEquivalent(parseFloat(sub.amount), sub.billingFrequency, sub.customFrequencyDays);

  // Per currency; amounts in different currencies are never added together.
  const monthlyTotals = totalsByCurrency(
    activeSubscriptions.map((sub) => ({ amount: monthlyOf(sub), currency: sub.currency })),
    userCurrency,
  );
  const yearlyTotals = monthlyTotals.map((total) => ({ ...total, amount: total.amount * 12 }));
  const missingPaymentsCount = subscriptions?.reduce((sum, sub) => sum + (sub.missingPayments || 0), 0) || 0;

  // Find subscriptions due soon, in calendar days from the user's today
  const today = localToday();
  const upcomingSubs = activeSubscriptions
    .filter(s => s.nextBillingDate)
    .map(s => ({
      ...s,
      billingDay: fromUtcDate(new Date(s.nextBillingDate)),
      daysUntil: daysBetween(today, fromUtcDate(new Date(s.nextBillingDate))),
    }))
    .filter(s => s.daysUntil >= 0 && s.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  // Category breakdown, in the user's own currency only (others can't be compared without rates)
  const inUserCurrency = activeSubscriptions.filter((sub) => sub.currency === userCurrency);
  const totalMonthlyInUserCurrency = inUserCurrency.reduce((sum, sub) => sum + monthlyOf(sub), 0);
  const categoryTotals = inUserCurrency.reduce((acc, sub) => {
    const category = sub.category || 'Other';
    acc[category] = (acc[category] || 0) + monthlyOf(sub);
    return acc;
  }, {} as Record<string, number>);

  const topCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Subscription Insights
        </CardTitle>
        <CardDescription>
          Overview of your recurring expenses and upcoming payments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Active Subscriptions</p>
            <p className="text-2xl font-bold">{activeSubscriptions.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Monthly Total</p>
            <p className="amount text-2xl font-semibold">{formatTotals(monthlyTotals, userCurrency)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Yearly Total</p>
            <p className="amount text-2xl font-semibold">{formatTotals(yearlyTotals, userCurrency)}</p>
          </div>
          {missingPaymentsCount > 0 && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-warning" aria-hidden="true" />
                Missing Receipts
              </p>
              <div className="flex items-baseline gap-2">
                <p className="amount text-2xl font-semibold text-warning">{missingPaymentsCount}</p>
                <Link href="/subscriptions?filter=missing">
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                    View All <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Top Categories */}
        {topCategories.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Top Spending Categories</h3>
            <div className="space-y-2">
              {topCategories.map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between">
                  <Badge variant="outline" className="capitalize">
                    {category}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <span className="amount text-sm font-medium">{formatCurrency(amount, userCurrency)}/mo</span>
                    <span className="text-xs text-muted-foreground">
                      ({totalMonthlyInUserCurrency > 0 ? ((amount / totalMonthlyInUserCurrency) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Payments */}
        {upcomingSubs.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming Payments (Next 7 Days)
            </h3>
            <div className="space-y-2">
              {upcomingSubs.map((sub) => (
                <div
                  key={sub.id}
                  className={cn(
                    'flex items-center justify-between rounded-lg border p-3',
                    urgencySurfaceClass(sub.daysUntil),
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{sub.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {sub.daysUntil === 0 ? 'Due Today' :
                       sub.daysUntil === 1 ? 'Due Tomorrow' :
                       `Due in ${sub.daysUntil} days`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="amount font-semibold">{formatCurrency(parseFloat(sub.amount), sub.currency)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatLocalDate(sub.billingDay, { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSubscriptions.length === 0 && (
          <div className="text-center py-8">
            <Coins className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              No active subscriptions tracked yet.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
