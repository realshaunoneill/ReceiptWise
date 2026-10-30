'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { parseAsInteger, useQueryState } from 'nuqs';
import { PiggyBank, Users, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { HouseholdSelector } from '@/components/households/household-selector';
import { BankCheck } from '@/components/plan/bank-check';
import { BillInbox } from '@/components/plan/bill-inbox';
import { EntryDialog } from '@/components/plan/entry-dialog';
import { GoalDialog } from '@/components/plan/goal-dialog';
import { HowItWorks } from '@/components/plan/how-it-works';
import { IncomeDialog } from '@/components/plan/income-dialog';
import { NextMonth } from '@/components/plan/next-month';
import { PeriodSwitcher } from '@/components/plan/period-switcher';
import { PlanLines } from '@/components/plan/plan-lines';
import { PlanSetup } from '@/components/plan/plan-setup';
import { PlanSummary } from '@/components/plan/plan-summary';
import { QuickAdd } from '@/components/plan/quick-add';
import { CreateSubscriptionDialog } from '@/components/subscriptions/create-subscription-dialog';
import { SubscriptionDetailModal } from '@/components/subscriptions/subscription-detail-modal';
import { SubscriptionUpsell } from '@/components/subscriptions/subscription-upsell';
import { type IncomeSource, type SavingsGoal } from '@/lib/db/schema';
import { useBillInbox } from '@/lib/hooks/use-bill-documents';
import { useHouseholds } from '@/lib/hooks/use-households';
import { useGoals, useIncome, usePlan, useSaveIncome } from '@/lib/hooks/use-plan';
import { useFeature, useUser } from '@/lib/hooks/use-user';
import { type PlanLine } from '@/lib/plan/compute-plan';
import { useAppHref } from '@/lib/app-base';

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
  const appHref = useAppHref();
  const { user, isLoading: userLoading, entitlements, hasFinanceAccess } = useUser();
  const billsEnabled = useFeature('bills');
  const [offset, setOffset] = useQueryState('offset', parseAsInteger.withDefault(0));
  const [householdParam, setHouseholdParam] = useQueryState('household');
  const householdId = householdParam ?? undefined;

  const ready = Boolean(user) && billsEnabled && hasFinanceAccess;
  const { data: plan, isLoading, error } = usePlan({ offset, householdId, enabled: ready });
  // The month after, for the "Plan December" card (and so stepping forward is instant).
  const { data: nextPlan, isPlaceholderData: nextIsStale } = usePlan({ offset: offset + 1, householdId, enabled: ready });
  const { data: incomes = [] } = useIncome(householdId, ready);
  const { data: goals = [] } = useGoals(householdId, ready);
  const { data: households = [] } = useHouseholds();
  const { data: inbox = [] } = useBillInbox(householdId, ready);

  const [incomeDialog, setIncomeDialog] = useState<{ open: boolean; income: IncomeSource | null }>({ open: false, income: null });
  const [goalDialog, setGoalDialog] = useState<{ open: boolean; goal: SavingsGoal | null }>({ open: false, goal: null });
  const [entryLine, setEntryLine] = useState<PlanLine | null>(null);
  const [billId, setBillId] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const { mutate: saveIncome, isPending: sharing } = useSaveIncome();

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
  const householdNames = Object.fromEntries((households as Array<{ id: string; name: string }>).map((household) => [household.id, household.name]));
  const householdName = householdId ? householdNames[householdId] ?? 'this household' : null;
  const editingIncome = (id: string) => incomes.find((income) => income.id === id) ?? null;
  const editingGoal = (id: string) => goals.find((goal) => goal.id === id) ?? null;

  // The viewer's own pay, in any scope: a household plan only loads what's shared with it, and
  // judging by that list alone said "Start with your pay" to someone with a salary, then saved
  // the new pay as primary and demoted the real one.
  const yourPrimary = plan?.primaryIncome ?? null;
  const yourIncomeCount = plan?.viewerIncomeCount ?? 0;
  const payNotShared = Boolean(householdId && yourPrimary && yourPrimary.householdId !== householdId);
  // Nothing in the plan at all yet: only the way in (Start with your pay) and How it works. The
  // summary at €0.00, the bank check, quick add and the buttons were too much to start from.
  const firstRun = Boolean(plan && plan.flags.includes('no_income') && !yourPrimary && yourIncomeCount === 0
    && plan.lines.length === 0 && plan.goals.length === 0);
  const sharePay = () => {
    if (!yourPrimary || !householdId) return;
    saveIncome(
      { id: yourPrimary.id, data: { householdId } },
      {
        onSuccess: () => toast.success(`${yourPrimary.name} is now shared with ${householdName}`),
        onError: (error) => toast.error(error.message),
      },
    );
  };

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

      {!firstRun && <PeriodSwitcher period={plan?.period} offset={offset} onOffsetChange={(next) => setOffset(next === 0 ? null : next)} />}

      {error && <Card><CardContent className="p-4 text-destructive">{error.message}</CardContent></Card>}
      {isLoading || !plan ? <PlanSkeleton /> : (
        <>
          {plan.flags.includes('no_income') && !yourPrimary && yourIncomeCount === 0 && (
            <Card className="border-primary/40 py-0">
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Wallet className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Start with your pay</p>
                    <p className="text-sm text-muted-foreground">Your pay and your main bills take a minute, and then the plan shows what&apos;s left after them.</p>
                  </div>
                </div>
                <Button onClick={() => setSetupOpen(true)}>Set up your plan</Button>
              </CardContent>
            </Card>
          )}
          {payNotShared && yourPrimary && (
            <Card className={plan.flags.includes('no_income') ? 'border-primary/40 py-0' : 'py-0'}>
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Your pay isn&apos;t counted in {householdName}&apos;s plan</p>
                    <p className="text-sm text-muted-foreground">Share it if you plan your money together.</p>
                  </div>
                </div>
                <Button variant={plan.flags.includes('no_income') ? 'default' : 'outline'} disabled={sharing} onClick={sharePay}>
                  Share {yourPrimary.name}
                </Button>
              </CardContent>
            </Card>
          )}

          <HowItWorks />
          {!firstRun && (
            <>
              <PlanSummary plan={plan} />
              {/* The bills near the top: the bank check and bills to file come first only once used,
                  and adding a one-off or a list follows the lines. */}
              {plan.balance && <BankCheck plan={plan} householdId={householdId} />}
              {inbox.length > 0 && <BillInbox plan={plan} householdId={householdId} />}

              <PlanLines
                plan={plan}
                viewerId={user!.id}
                householdNames={householdNames}
                onEditEntry={setEntryLine}
                onEditIncome={(id) => setIncomeDialog({ open: true, income: editingIncome(id) })}
                onEditGoal={(id) => setGoalDialog({ open: true, goal: editingGoal(id) })}
                onOpenBill={setBillId}
              />
              {/* After the lines, so it isn't read as a second total for this month. */}
              <NextMonth plan={nextIsStale ? undefined : nextPlan} onOpen={() => setOffset(offset + 1)} />

              <QuickAdd plan={plan} householdId={householdId} />
              {!plan.balance && <BankCheck plan={plan} householdId={householdId} />}
              {inbox.length === 0 && <BillInbox plan={plan} householdId={householdId} />}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setIncomeDialog({ open: true, income: null })}>
                  <Wallet className="mr-1.5 h-4 w-4" />{yourIncomeCount === 0 ? 'Add your pay' : 'Add income'}
                </Button>
                <Button variant="outline" onClick={() => setGoalDialog({ open: true, goal: null })}>
                  <PiggyBank className="mr-1.5 h-4 w-4" />Add savings
                </Button>
                {/* Adds an essential bill by default (bill-fields' DEFAULT_BILL_FIELDS). */}
                <CreateSubscriptionDialog label="Add a bill" variant="outline" />
                <Button variant="ghost" asChild><Link href={appHref('/subscriptions')}>All bills</Link></Button>
              </div>
            </>
          )}
        </>
      )}

      <IncomeDialog
        open={incomeDialog.open}
        onOpenChange={(open) => setIncomeDialog((state) => ({ ...state, open }))}
        income={incomeDialog.income}
        isFirst={incomeDialog.income
          ? Boolean(incomeDialog.income.isPrimary && yourIncomeCount <= 1)
          : !yourPrimary}
        currentPrimary={yourPrimary}
        householdId={householdId}
      />
      <GoalDialog
        open={goalDialog.open}
        onOpenChange={(open) => setGoalDialog((state) => ({ ...state, open }))}
        goal={goalDialog.goal}
        householdId={householdId}
      />
      <EntryDialog line={entryLine} onOpenChange={(open) => !open && setEntryLine(null)} />
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogTitle className="sr-only">Set up your plan</DialogTitle>
          <PlanSetup currency={plan?.currency ?? user?.currency ?? 'EUR'} householdId={householdId} onDone={() => setSetupOpen(false)} onSkip={() => setSetupOpen(false)} />
        </DialogContent>
      </Dialog>
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
