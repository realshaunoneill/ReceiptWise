'use client';

import Link from 'next/link';
import { ArrowRight, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { usePlan } from '@/lib/hooks/use-plan';
import { useFeature, useUser } from '@/lib/hooks/use-user';
import { cn } from '@/lib/utils';
import { formatCents } from '@/lib/utils/currency';

/**
 * This period's bottom line on the dashboard: what remains, the weekly split, and what's left in the
 * bank if known. `householdId` scopes it to a household (the dashboard's picker, or the household
 * that covers a member without Premium of their own).
 */
export function PlanCard({ householdId }: { householdId?: string }) {
  const billsEnabled = useFeature('bills');
  const { hasFinanceAccess } = useUser();
  const { data: plan } = usePlan({ householdId, enabled: billsEnabled && hasFinanceAccess });

  if (!billsEnabled || !hasFinanceAccess || !plan) return null;

  const { totals, currency, period, balance } = plan;
  const over = totals.remainingCents < 0;
  return (
    <Link href={householdId ? `/plan?household=${encodeURIComponent(householdId)}` : '/plan'} className="block">
      <Card className="transition-colors hover:border-primary/50" data-private>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Wallet className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm text-muted-foreground">This month&apos;s plan · {period.label}</p>
              {plan.flags.includes('no_income') && totals.outgoingCents === 0 ? (
                <p className="font-medium">Plan your month: add your pay and bills</p>
              ) : (
                <>
                  {/* Negative figures read as "-€765.27 remaining · -€191.32 a week": say "over". The
                      plan's figure and the account's are named apart, so "€2,539 left" and "€289 short"
                      don't read as a contradiction. */}
                  <p className={cn('amount text-2xl font-semibold', over && 'text-destructive')}>
                    {over
                      ? `${formatCents(-totals.remainingCents, currency)} over in the plan`
                      : `${formatCents(totals.remainingCents, currency)} left in the plan`}
                  </p>
                  <p className="amount text-sm text-muted-foreground">
                    {!over && `${formatCents(totals.weeklyCents, currency)} a week`}
                    {!over && balance && ' · '}
                    {balance && (balance.availableCents < 0
                      ? `your account is ${formatCents(-balance.availableCents, currency)} short before payday`
                      : `${formatCents(balance.availableCents, currency)} left in your account until payday`)}
                  </p>
                </>
              )}
            </div>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </CardContent>
      </Card>
    </Link>
  );
}
