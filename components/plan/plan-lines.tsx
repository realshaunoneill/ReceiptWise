'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, MoreHorizontal, Pencil, Receipt as ReceiptIcon, RotateCcw, SkipForward, Trash2, Undo2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useUpdateOccurrence } from '@/hooks/use-subscriptions';
import { formatLocalDate, localToday } from '@/lib/dates/local-date';
import { useAddContribution, useCreateEntries, useDeleteEntry, useRemoveContributions, useSetPlanAmount, useUpdateEntry } from '@/lib/hooks/use-plan';
import { fromCents, toCents } from '@/lib/money';
import { type GoalSummary, type PlanLine } from '@/lib/plan/compute-plan';
import { type PlanResponse } from '@/lib/services/plan-service';
import { cn } from '@/lib/utils';
import { formatCents } from '@/lib/utils/currency';
import { PAYMENT_METHOD_LABEL, TAP_TARGET } from './labels';

export type PlanLineHandlers = {
  onEditEntry: (line: PlanLine) => void;
  onEditIncome: (incomeId: string) => void;
  onEditGoal: (goalId: string) => void;
  onOpenBill: (subscriptionId: string) => void;
};

type PlanLinesProps = PlanLineHandlers & {
  plan: PlanResponse;
  viewerId: string;
  /** Household names by id, to say which one a line is shared with in your own plan. */
  householdNames?: Record<string, string>;
};

/** What every row needs besides its line: the plan, and the names of households for "Shared". */
type RowContext = { plan: PlanResponse; householdNames: Record<string, string> };

/** The day to record a payment or contribution on: today if it's in the period, else the period's first day. */
function settleDay(plan: PlanResponse): string {
  const today = localToday();
  return today >= plan.period.start && today < plan.period.end ? today : plan.period.start;
}

/** Tap the amount to change it for this period only; Enter or leaving the field saves. */
function AmountEditor({
  cents,
  currency,
  estimated,
  disabled,
  className,
  title = 'Change for this period',
  onSave,
}: {
  cents: number;
  currency: string;
  estimated: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
  onSave: (amount: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(fromCents(cents));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = toCents(value);
    if (next === null || next < 0) {
      setValue(fromCents(cents));
      if (value.trim()) toast.error('Enter an amount of 0 or more');
      return;
    }
    if (next !== cents) onSave(fromCents(next));
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setValue(fromCents(cents));
            setEditing(false);
          }
        }}
        inputMode="decimal"
        className="amount h-11 w-28 text-right"
        aria-label="Amount for this period"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        setValue(fromCents(cents));
        setEditing(true);
      }}
      className={cn(
        'amount min-h-11 rounded-md px-2 text-right font-semibold tabular-nums',
        !disabled && 'hover:bg-accent',
        estimated && 'text-muted-foreground',
        className,
      )}
      title={disabled ? undefined : title}
    >
      {estimated ? '~' : ''}{formatCents(cents, currency)}
    </button>
  );
}

function RecurringRow({ line, context, handlers }: { line: PlanLine; context: RowContext; handlers: PlanLineHandlers }) {
  const { plan } = context;
  const { mutate: updateOccurrence, isPending, variables } = useUpdateOccurrence(line.sourceId);
  const change = (data: Parameters<typeof updateOccurrence>[0]['data'], message: string) =>
    updateOccurrence(
      { expectedDate: line.cycleDate!, data },
      { onSuccess: () => toast.success(message), onError: (error) => toast.error(error.message) },
    );

  // While a change saves and the plan refreshes, show it as made; a failure puts it back.
  const saving = isPending ? variables?.data : undefined;
  const paid = saving?.status ? saving.status === 'paid' : line.status === 'paid';
  const skipped = saving?.status ? saving.status === 'skipped' : line.status === 'skipped';
  const savingAmount = saving?.actualAmount ?? saving?.expectedAmount;
  const amountCents = (savingAmount !== undefined ? toCents(savingAmount) : null) ?? line.amountCents;

  return (
    <LineShell
      line={line}
      context={context}
      checked={paid}
      disabled={isPending || skipped}
      onCheckedChange={(checked) =>
        checked
          ? change({ status: 'paid', actualDate: settleDay(plan) }, 'Marked paid')
          // Unticking an assumed direct debit means it didn't go out: missed, which the daily job
          // won't assume paid again (back to pending, it would be ticked again overnight).
          : line.paidVia === 'assumed'
            ? change({ status: 'missed' }, "Marked as didn't go out")
            : change({ status: 'pending' }, 'Marked not paid')}
      checkboxLabel={paid ? `Mark ${line.label} not paid` : `Mark ${line.label} paid`}
      onLabelClick={() => handlers.onOpenBill(line.sourceId)}
      badges={
        <>
          {line.paidVia === 'assumed' && paid && <Badge variant="secondary">Assumed paid</Badge>}
          {line.paidVia === 'receipt' && paid && (
            <Badge variant="outline"><ReceiptIcon className="mr-1 h-3 w-3" />Receipt</Badge>
          )}
          {line.status === 'overdue' && !saving?.status && <Badge variant="destructive">Overdue</Badge>}
          {line.estimated && !paid && <Badge variant="outline">Estimate</Badge>}
          {skipped && <Badge variant="outline">Skipped</Badge>}
        </>
      }
      detail={line.paymentMethod ? PAYMENT_METHOD_LABEL[line.paymentMethod] : undefined}
      amount={
        <AmountEditor
          cents={amountCents}
          currency={line.currency}
          estimated={line.estimated && !paid && savingAmount === undefined}
          disabled={isPending || skipped}
          onSave={(amount) => change(paid ? { actualAmount: amount } : { expectedAmount: amount }, 'Amount updated')}
        />
      }
      menu={
        <>
          {skipped ? (
            <DropdownMenuItem onClick={() => change({ status: 'pending' }, 'Back in the plan')}>
              <Undo2 className="mr-2 h-4 w-4" />Don&apos;t skip
            </DropdownMenuItem>
          ) : !paid && (
            <DropdownMenuItem onClick={() => change({ status: 'skipped' }, 'Skipped this time')}>
              <SkipForward className="mr-2 h-4 w-4" />Skip this time
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => handlers.onOpenBill(line.sourceId)}>
            <Pencil className="mr-2 h-4 w-4" />Bill details
          </DropdownMenuItem>
        </>
      }
    />
  );
}

function EntryRow({ line, viewerId, context, handlers }: { line: PlanLine; viewerId: string; context: RowContext; handlers: PlanLineHandlers }) {
  const { mutate: updateEntry, isPending, variables } = useUpdateEntry();
  const { mutate: deleteEntry } = useDeleteEntry();
  const { mutate: createEntries } = useCreateEntries();
  const isOwner = line.ownerUserId === viewerId;

  // While a change saves and the plan refreshes, show it as made; a failure puts it back.
  const saving = isPending ? variables?.data : undefined;
  const done = saving?.done ?? line.status === 'done';
  const amountCents = (saving?.amount !== undefined ? toCents(saving.amount) : null) ?? line.amountCents;

  // Remove acts at once, with Undo in the toast (it used to remove for good on one tap).
  const remove = () => deleteEntry(line.sourceId, {
    onSuccess: () => toast.success(`Removed ${line.label}`, {
      action: {
        label: 'Undo',
        onClick: () => createEntries(
          [{
            date: line.date,
            label: line.label,
            amount: fromCents(line.amountCents),
            direction: line.direction,
            category: line.category ?? null,
            notes: line.notes ?? null,
            done: line.status === 'done',
            householdId: line.householdId,
          }],
          { onError: (error) => toast.error(error.message) },
        ),
      },
    }),
    onError: (error) => toast.error(error.message),
  });

  return (
    <LineShell
      line={line}
      context={context}
      checked={done}
      disabled={isPending}
      onCheckedChange={(checked) => updateEntry({ id: line.sourceId, data: { done: checked } }, { onError: (error) => toast.error(error.message) })}
      onLabelClick={isOwner ? () => handlers.onEditEntry(line) : undefined}
      detail={line.category ?? undefined}
      amount={
        <AmountEditor
          cents={amountCents}
          currency={line.currency}
          estimated={false}
          disabled={!isOwner || isPending}
          onSave={(amount) => updateEntry({ id: line.sourceId, data: { amount } }, { onError: (error) => toast.error(error.message) })}
        />
      }
      menu={isOwner ? (
        <>
          <DropdownMenuItem onClick={() => handlers.onEditEntry(line)}>
            <Pencil className="mr-2 h-4 w-4" />Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={remove}>
            <Trash2 className="mr-2 h-4 w-4" />Remove
          </DropdownMenuItem>
        </>
      ) : undefined}
    />
  );
}

function GoalProgress({ goal, currency, onEdit }: { goal: GoalSummary; currency: string; onEdit?: () => void }) {
  if (!goal.targetCents) return null;
  return (
    <div className="space-y-1 pb-1">
      <div className="flex justify-between gap-2 text-xs text-muted-foreground">
        {onEdit ? (
          <button type="button" className="min-h-11 font-medium text-foreground hover:underline sm:min-h-0" onClick={onEdit}>{goal.name}</button>
        ) : <span />}
        <span className="amount self-center">
          {formatCents(goal.savedCents, currency)} of {formatCents(goal.targetCents, currency)}
          {goal.linkedAccount && ` · in ${goal.linkedAccount.name}`}
        </span>
      </div>
      <Progress value={Math.min(100, Math.round((goal.savedCents / goal.targetCents) * 100))} aria-label={`${goal.name}: saved so far`} />
      {goal.onTrack === false && goal.neededPerCycleCents !== null && (
        <p className="amount text-xs text-warning">{formatCents(goal.neededPerCycleCents, currency)} a month needed to reach it in time</p>
      )}
    </div>
  );
}

/**
 * This payday's pay or this period's savings at a different amount (plan_amounts): Megan's sheet
 * changes both by hand most months. While it saves, the new amount shows.
 */
function useMonthAmount(line: PlanLine, day: string) {
  const { mutate, isPending, variables } = useSetPlanAmount();
  const source = line.source === 'goal' ? 'goal' : 'income';
  const save = (amount: string | null, message?: string) => mutate(
    { source, sourceId: line.sourceId, day, amount },
    { onSuccess: () => message && toast.success(message), onError: (error) => toast.error(error.message) },
  );
  const pendingCents = isPending ? (variables.amount === null ? line.usualCents : toCents(variables.amount)) : undefined;
  return { save, isPending, cents: pendingCents ?? line.amountCents };
}

/** "Just for November" on pay or savings changed for this month only. */
function JustThisMonth({ line, month }: { line: PlanLine; month: string }) {
  if (line.usualCents === undefined) return null;
  return <Badge variant="outline" title={`Usually ${formatCents(line.usualCents, line.currency)}`}>Just for {month}</Badge>;
}

function GoalRow({ line, viewerId, context, handlers }: { line: PlanLine; viewerId: string; context: RowContext; handlers: PlanLineHandlers }) {
  const { plan } = context;
  const { mutate: addContribution, isPending: adding } = useAddContribution();
  const { mutate: removeContributions, isPending: removing } = useRemoveContributions();
  const amount = useMonthAmount(line, plan.period.start);
  // While it saves and the plan refreshes, show it as made; a failure puts it back.
  const done = adding ? true : removing ? false : line.status === 'done';
  const summary = plan.goals.find((goal) => goal.id === line.sourceId);
  const month = plan.period.label.split(' ')[0];
  // Once it's put aside, the line is what went in: untick it to change the amount.
  const canChange = line.ownerUserId === viewerId && !done;

  return (
    <LineShell
      line={line}
      context={context}
      below={summary && <GoalProgress goal={summary} currency={plan.currency} />}
      checked={done}
      disabled={adding || removing}
      onCheckedChange={(checked) => {
        if (checked) {
          addContribution(
            { goalId: line.sourceId, amount: fromCents(line.amountCents), contributedOn: settleDay(plan) },
            { onSuccess: () => toast.success(`Saved towards ${line.label}`), onError: (error) => toast.error(error.message) },
          );
        } else {
          removeContributions(
            { goalId: line.sourceId, contributionIds: line.contributionIds ?? [] },
            { onError: (error) => toast.error(error.message) },
          );
        }
      }}
      onLabelClick={() => handlers.onEditGoal(line.sourceId)}
      detail="Savings"
      badges={!done && <JustThisMonth line={line} month={month} />}
      amount={canChange ? (
        <AmountEditor
          cents={amount.cents}
          currency={line.currency}
          estimated={false}
          disabled={amount.isPending}
          title={`Put aside a different amount in ${month} only`}
          // Typing the usual amount back in is the same as going back to it.
          onSave={(value) => amount.save(line.usualCents !== undefined && toCents(value) === line.usualCents ? null : value)}
        />
      ) : (
        <button type="button" onClick={() => handlers.onEditGoal(line.sourceId)} className="amount min-h-11 rounded-md px-2 text-right font-semibold tabular-nums hover:bg-accent">
          {formatCents(line.amountCents, line.currency)}
        </button>
      )}
      menu={canChange ? (
        <>
          <DropdownMenuItem onClick={() => handlers.onEditGoal(line.sourceId)}>
            <Pencil className="mr-2 h-4 w-4" />Edit the goal
          </DropdownMenuItem>
          {line.usualCents !== undefined && (
            <DropdownMenuItem onClick={() => amount.save(null, `Back to ${formatCents(line.usualCents!, line.currency)}`)}>
              <RotateCcw className="mr-2 h-4 w-4" />Back to the usual {formatCents(line.usualCents, line.currency)}
            </DropdownMenuItem>
          )}
        </>
      ) : undefined}
    />
  );
}

function IncomeRow({ line, viewerId, context, handlers }: { line: PlanLine; viewerId: string; context: RowContext; handlers: PlanLineHandlers }) {
  const amount = useMonthAmount(line, line.date);
  const month = context.plan.period.label.split(' ')[0];
  const isOwner = line.ownerUserId === viewerId;
  const edit = () => handlers.onEditIncome(line.sourceId);
  return (
    <LineShell
      line={line}
      context={context}
      onLabelClick={edit}
      detail={line.status === 'paid' ? 'Arrived' : 'Due'}
      badges={<JustThisMonth line={line} month={month} />}
      amount={isOwner ? (
        <AmountEditor
          cents={amount.cents}
          currency={line.currency}
          estimated={false}
          disabled={amount.isPending}
          className="text-success"
          title={`Change your pay for ${month} only`}
          onSave={(value) => amount.save(line.usualCents !== undefined && toCents(value) === line.usualCents ? null : value)}
        />
      ) : (
        <button type="button" onClick={edit} className="amount min-h-11 rounded-md px-2 text-right font-semibold tabular-nums text-success hover:bg-accent">
          {formatCents(line.amountCents, line.currency)}
        </button>
      )}
      menu={isOwner ? (
        <>
          <DropdownMenuItem onClick={edit}>
            <Pencil className="mr-2 h-4 w-4" />Edit your pay
          </DropdownMenuItem>
          {line.usualCents !== undefined && (
            <DropdownMenuItem onClick={() => amount.save(null, `Back to ${formatCents(line.usualCents!, line.currency)}`)}>
              <RotateCcw className="mr-2 h-4 w-4" />Back to the usual {formatCents(line.usualCents, line.currency)}
            </DropdownMenuItem>
          )}
        </>
      ) : undefined}
    />
  );
}

/**
 * One row: tick-off box, label with date and badges, amount, and a menu. Sized for a thumb: the
 * tick box and the label are small to look at but take a 44px tap, the minimum comfortable target.
 */
function LineShell({
  line,
  context,
  below,
  checked,
  disabled,
  onCheckedChange,
  onLabelClick,
  badges,
  detail,
  amount,
  menu,
  checkboxLabel,
}: {
  line: PlanLine;
  context: RowContext;
  /** Shown under the row, full width (a goal's progress). */
  below?: React.ReactNode;
  checkboxLabel?: string;
  checked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onLabelClick?: () => void;
  badges?: React.ReactNode;
  detail?: string;
  amount: React.ReactNode;
  menu?: React.ReactNode;
}) {
  const struck = line.status === 'skipped' || line.notCountedReason === 'other_currency';
  // In your own plan, say which lines the household sees too.
  const sharedWith = context.plan.scope.type === 'mine' && line.householdId
    ? context.householdNames[line.householdId] ?? 'your household'
    : null;
  return (
    <li className="py-1.5">
      <div className="flex items-center gap-3">
        {onCheckedChange ? (
          <Checkbox
            checked={checked}
            disabled={disabled}
            onCheckedChange={(value) => onCheckedChange(value === true)}
            className={cn('size-5', TAP_TARGET)}
            aria-label={checkboxLabel ?? (checked ? `Mark ${line.label} not done` : `Mark ${line.label} done`)}
          />
        ) : (
          <span className="size-5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          {/* The ::after stretches the tap area over the date line too; the bill link sits above it. */}
          <button
            type="button"
            disabled={!onLabelClick}
            onClick={onLabelClick}
            className={cn(
              "relative block max-w-full text-left font-medium after:absolute after:inset-x-0 after:-top-1.5 after:-bottom-6 after:content-['']",
              struck && 'text-muted-foreground line-through',
              checked && 'text-muted-foreground',
            )}
          >
            <span className="block truncate">{line.label}</span>
          </button>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{formatLocalDate(line.date, { day: 'numeric', month: 'short' }, 'en-IE')}</span>
            {detail && <span>· {detail}</span>}
            {line.notCountedReason === 'other_currency' && <span>· not counted ({line.currency})</span>}
            {sharedWith && (
              <Badge variant="outline" title={`Shared with ${sharedWith}`}><Users className="mr-1 h-3 w-3" />Shared</Badge>
            )}
            {line.billDocumentId && (
              <a
                href={`/api/bills/documents/${line.billDocumentId}/file`}
                target="_blank"
                rel="noopener noreferrer"
                className="relative z-10 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 hover:text-foreground"
              >
                <FileText className="h-3 w-3" />From bill · View
              </a>
            )}
            {badges}
          </div>
        </div>
        {amount}
        {menu ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={`More for ${line.label}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">{menu}</DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="w-11 shrink-0" />
        )}
      </div>
      {below && <div className="pl-8 pr-14">{below}</div>}
    </li>
  );
}

function Section({ title, totalCents, currency, hint, children }: { title: string; totalCents: number; currency: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card data-private>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <span className="amount text-sm font-semibold text-muted-foreground">{formatCents(totalCents, currency)}</span>
      </CardHeader>
      <CardContent className="pt-2">
        <ul className="divide-y">{children}</ul>
        {hint && <p className="pt-2 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

const sum = (lines: PlanLine[]) => lines.filter((line) => line.counted).reduce((total, line) => total + line.amountCents, 0);

export function PlanLines({ plan, viewerId, householdNames = {}, ...handlers }: PlanLinesProps) {
  const incoming = plan.lines.filter((line) => line.direction === 'in');
  const recurring = plan.lines.filter((line) => line.direction === 'out' && line.source === 'recurring');
  const goals = plan.lines.filter((line) => line.source === 'goal');
  const oneOffs = plan.lines.filter((line) => line.direction === 'out' && line.source === 'entry');
  const month = plan.period.label.split(' ')[0];
  const context: RowContext = { plan, householdNames };
  // Goals with a target but nothing to put aside this period still show their progress here,
  // with the rest of savings (it used to sit in an untitled card at the bottom of the page).
  const progressOnly = plan.goals.filter((goal) => goal.targetCents && !goals.some((line) => line.sourceId === goal.id));

  return (
    <div className="space-y-4">
      {incoming.length > 0 && (
        <Section
          title="Coming in"
          totalCents={sum(incoming)}
          currency={plan.currency}
          hint={incoming.some((line) => line.source === 'income' && line.ownerUserId === viewerId) ? `Click your pay to change it for ${month} only.` : undefined}
        >
          {incoming.map((line) => (line.source === 'entry'
            ? <EntryRow key={line.key} line={line} viewerId={viewerId} context={context} handlers={handlers} />
            : <IncomeRow key={line.key} line={line} viewerId={viewerId} context={context} handlers={handlers} />))}
        </Section>
      )}
      {recurring.length > 0 && (
        <Section
          title="Bills & subscriptions"
          totalCents={sum(recurring)}
          currency={plan.currency}
          hint={`Click an amount to change it for ${month} only: a bigger credit card bill, an electricity bill that came in.`}
        >
          {recurring.map((line) => <RecurringRow key={line.key} line={line} context={context} handlers={handlers} />)}
        </Section>
      )}
      {(goals.length > 0 || progressOnly.length > 0) && (
        <Section
          title="Savings"
          totalCents={sum(goals)}
          currency={plan.currency}
          hint={goals.some((line) => line.ownerUserId === viewerId && line.status !== 'done') ? `Click an amount to put aside more or less in ${month} only.` : undefined}
        >
          {goals.map((line) => <GoalRow key={line.key} line={line} viewerId={viewerId} context={context} handlers={handlers} />)}
          {progressOnly.map((goal) => (
            <li key={goal.id} className="py-2">
              <GoalProgress goal={goal} currency={plan.currency} onEdit={() => handlers.onEditGoal(goal.id)} />
            </li>
          ))}
        </Section>
      )}
      {oneOffs.length > 0 && (
        <Section title={`Just for ${month}`} totalCents={sum(oneOffs)} currency={plan.currency}>
          {oneOffs.map((line) => <EntryRow key={line.key} line={line} viewerId={viewerId} context={context} handlers={handlers} />)}
        </Section>
      )}
    </div>
  );
}
