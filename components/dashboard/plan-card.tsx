'use client';

import Link from 'next/link';
import { ArrowRight, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { usePlan } from '@/lib/hooks/use-plan';
import { useFeature, useUser } from '@/lib/hooks/use-user';
import { cn } from '@/lib/utils';
import { formatCents } from '@/lib/utils/currency';

/** This period's bottom line on the dashboard: what remains, the weekly split, and what's left in the bank if known. */
export function PlanCard() {
  const billsEnabled = useFeature('bills');
  const { hasFinanceAccess } = useUser();
  const { data: plan } = usePlan({ enabled: billsEnabled && hasFinanceAccess });

  if (!billsEnabled || !hasFinanceAccess || !plan) return null;

  const { totals, currency, period, balance } = plan;
  return (
    <Link href="/plan" className="block">
      <Card className="transition-colors hover:border-primary/50" data-private>
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <Wallet className="mt-1 h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">{period.label}</p>
              {plan.flags.includes('no_income') && totals.outgoingCents === 0 ? (
                <p className="font-medium">Plan your month: add your pay and bills</p>
              ) : (
                <>
                  <p className={cn('amount text-2xl font-semibold', totals.remainingCents < 0 && 'text-destructive')}>
                    {formatCents(totals.remainingCents, currency)} remaining
                  </p>
                  <p className="amount text-sm text-muted-foreground">
                    {formatCents(totals.weeklyCents, currency)} a week
                    {balance && ` · ${formatCents(balance.availableCents, currency)} left in the bank until payday`}
                  </p>
                </>
              )}
            </div>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
