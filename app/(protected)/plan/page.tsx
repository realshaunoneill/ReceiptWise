'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { parseAsInteger, useQueryState } from 'nuqs';
import { PiggyBank, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { HouseholdSelector } from '@/components/households/household-selector';
import { BankCheck } from '@/components/plan/bank-check';
import { BillInbox } from '@/components/plan/bill-inbox';
import { EntryDialog } from '@/components/plan/entry-dialog';
import { GoalDialog } from '@/components/plan/goal-dialog';
import { IncomeDialog } from '@/components/plan/income-dialog';
import { PeriodSwitcher } from '@/components/plan/period-switcher';
import { PlanLines } from '@/components/plan/plan-lines';
import { PlanSummary } from '@/components/plan/plan-summary';
import { QuickAdd } from '@/components/plan/quick-add';
import { SubscriptionDetailModal } from '@/components/subscriptions/subscription-detail-modal';
import { SubscriptionUpsell } from '@/components/subscriptions/subscription-upsell';
import { type IncomeSource, type SavingsGoal } from '@/lib/db/schema';
import { useHouseholds } from '@/lib/hooks/use-households';
import { useGoals, useIncome, usePlan } from '@/lib/hooks/use-plan';
import { useFeature, useUser } from '@/lib/hooks/use-user';
import { type PlanLine } from '@/lib/plan/compute-plan';
import { formatCents } from '@/lib/utils/currency';

function PlanSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function PlanPageContent() {
  const { user, isLoading: userLoading, entitlements, hasFinanceAccess } = useUser();
  const billsEnabled = useFeature('bills');
  const [offset, setOffset] = useQueryState('offset', parseAsInteger.withDefault(0));
  const [householdParam, setHouseholdParam] = useQueryState('household');
  const householdId = householdParam ?? undefined;

  const ready = Boolean(user) && billsEnabled && hasFinanceAccess;
  const { data: plan, isLoading, error } = usePlan({ offset, householdId, enabled: ready });
  const { data: incomes = [] } = useIncome(householdId, ready);
  const { data: goals = [] } = useGoals(householdId, ready);
  const { data: households = [] } = useHouseholds();

  const [incomeDialog, setIncomeDialog] = useState<{ open: boolean; income: IncomeSource | null }>({ open: false, income: null });
  const [goalDialog, setGoalDialog] = useState<{ open: boolean; goal: SavingsGoal | null }>({ open: false, goal: null });
  const [entryLine, setEntryLine] = useState<PlanLine | null>(null);
  const [billId, setBillId] = useState<string | null>(null);

  if (userLoading) {
    return <main className="container mx-auto max-w-3xl p-4 sm:p-6"><PlanSkeleton /></main>;
  }

  if (!billsEnabled) {
    return (
      <main className="container mx-auto max-w-3xl p-4 sm:p-6">
        <Card><CardContent className="p-6 text-muted-foreground">The plan isn&apos;t available on your account yet. <Link className="text-primary underline" href="/dashboard">Back to the dashboard</Link></CardContent></Card>
      </main>
    );
  }

  if (!hasFinanceAccess) {
    return (
      <main className="container mx-auto max-w-3xl p-4 sm:p-6">
        <SubscriptionUpsell
          title="Plan your month with Premium"
          description="Your pay, your bills and what's left for the week, all in one place"
          features={[
            'Payday to payday plan, a month at a time',
            'Bills and subscriptions that fill themselves in',
            'Savings goals, and a weekly split of what remains',
            'Share it with your household',
          ]}
        />
      </main>
    );
  }

  // Households where the plan can be shared: membership plus someone paying.
  const sharedHouseholds = (households as Array<{ id: string; name: string }>)
    .filter((household) => entitlements?.householdIds.includes(household.id));
  const myIncome = incomes.filter((income) => income.userId === user?.id);
  const editingIncome = (id: string) => incomes.find((income) => income.id === id) ?? null;
  const editingGoal = (id: string) => goals.find((goal) => goal.id === id) ?? null;

  return (
    <main className="container mx-auto max-w-3xl space-y-4 p-4 pb-24 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plan</h1>
          <p className="text-sm text-muted-foreground">Your pay, what&apos;s going out, and what&apos;s left.</p>
        </div>
        {sharedHouseholds.length > 0 && (
          <HouseholdSelector
            households={[
              { id: '', name: 'Just me' },
              ...sharedHouseholds,
            ] as Parameters<typeof HouseholdSelector>[0]['households']}
            selectedHouseholdId={householdId ?? ''}
            onSelect={(id) => setHouseholdParam(id || null)}
          />
        )}
      </div>

      <PeriodSwitcher period={plan?.period} offset={offset} onOffsetChange={(next) => setOffset(next === 0 ? null : next)} />

      {error && <Card><CardContent className="p-4 text-destructive">{error.message}</CardContent></Card>}
      {isLoading || !plan ? <PlanSkeleton /> : (
        <>
          {plan.flags.includes('no_income') && (
            <Card className="border-primary/40">
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Wallet className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Start with your pay</p>
                    <p className="text-sm text-muted-foreground">Add what comes in and when, and the plan runs payday to payday.</p>
                  </div>
                </div>
                <Button onClick={() => setIncomeDialog({ open: true, income: null })}>Add your pay</Button>
              </CardContent>
            </Card>
          )}

          <PlanSummary plan={plan} />
          <BankCheck plan={plan} householdId={householdId} />
          <QuickAdd plan={plan} householdId={householdId} />
          <BillInbox plan={plan} householdId={householdId} />

          <PlanLines
            plan={plan}
            viewerId={user!.id}
            onEditEntry={setEntryLine}
            onEditIncome={(id) => setIncomeDialog({ open: true, income: editingIncome(id) })}
            onEditGoal={(id) => setGoalDialog({ open: true, goal: editingGoal(id) })}
            onOpenBill={setBillId}
          />

          {plan.goals.some((goal) => goal.targetCents) && (
            <Card data-private>
              <CardContent className="space-y-3 p-5">
                {plan.goals.filter((goal) => goal.targetCents).map((goal) => (
                  <div key={goal.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <button type="button" className="font-medium hover:underline" onClick={() => setGoalDialog({ open: true, goal: editingGoal(goal.id) })}>{goal.name}</button>
                      <span className="amount text-muted-foreground">{formatCents(goal.savedCents, plan.currency)} of {formatCents(goal.targetCents!, plan.currency)}</span>
                    </div>
                    <Progress value={Math.min(100, Math.round((goal.savedCents / goal.targetCents!) * 100))} />
                    {goal.onTrack === false && goal.neededPerCycleCents !== null && (
                      <p className="amount text-xs text-warning">{formatCents(goal.neededPerCycleCents, plan.currency)} a month needed to reach it in time</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setIncomeDialog({ open: true, income: null })}>
              <Wallet className="mr-1.5 h-4 w-4" />{myIncome.length === 0 ? 'Add your pay' : 'Add income'}
            </Button>
            <Button variant="outline" onClick={() => setGoalDialog({ open: true, goal: null })}>
              <PiggyBank className="mr-1.5 h-4 w-4" />Add savings
            </Button>
            <Button variant="ghost" asChild><Link href="/subscriptions">All bills &amp; subscriptions</Link></Button>
          </div>
        </>
      )}

      <IncomeDialog
        open={incomeDialog.open}
        onOpenChange={(open) => setIncomeDialog((state) => ({ ...state, open }))}
        income={incomeDialog.income}
        isFirst={myIncome.length === 0 || Boolean(incomeDialog.income?.isPrimary && myIncome.length === 1)}
        householdId={householdId}
      />
      <GoalDialog
        open={goalDialog.open}
        onOpenChange={(open) => setGoalDialog((state) => ({ ...state, open }))}
        goal={goalDialog.goal}
        householdId={householdId}
      />
      <EntryDialog line={entryLine} onOpenChange={(open) => !open && setEntryLine(null)} />
      <SubscriptionDetailModal subscriptionId={billId} open={Boolean(billId)} onOpenChange={(open) => !open && setBillId(null)} />
    </main>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={<main className="container mx-auto max-w-3xl p-4 sm:p-6"><PlanSkeleton /></main>}>
      <PlanPageContent />
    </Suspense>
  );
}
