'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, Receipt as ReceiptIcon, SkipForward, Trash2, Undo2 } from 'lucide-react';
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
import { useUpdateOccurrence } from '@/hooks/use-subscriptions';
import { formatLocalDate, localToday } from '@/lib/dates/local-date';
import { useAddContribution, useDeleteEntry, useRemoveContributions, useUpdateEntry } from '@/lib/hooks/use-plan';
import { fromCents, toCents } from '@/lib/money';
import { type PlanLine } from '@/lib/plan/compute-plan';
import { type PlanResponse } from '@/lib/services/plan-service';
import { cn } from '@/lib/utils';
import { formatCents } from '@/lib/utils/currency';

export type PlanLineHandlers = {
  onEditEntry: (line: PlanLine) => void;
  onEditIncome: (incomeId: string) => void;
  onEditGoal: (goalId: string) => void;
  onOpenBill: (subscriptionId: string) => void;
};

type PlanLinesProps = PlanLineHandlers & {
  plan: PlanResponse;
  viewerId: string;
};

const METHOD_LABEL: Record<string, string> = {
  direct_debit: 'Direct debit',
  standing_order: 'Standing order',
  card: 'Card',
  manual: 'Pay manually',
};

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
  onSave,
}: {
  cents: number;
  currency: string;
  estimated: boolean;
  disabled?: boolean;
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
        className="amount h-10 w-28 text-right"
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
        'amount min-h-10 rounded-md px-2 text-right font-semibold tabular-nums',
        !disabled && 'hover:bg-accent',
        estimated && 'text-muted-foreground',
      )}
      title={disabled ? undefined : 'Change for this period'}
    >
      {estimated ? '~' : ''}{formatCents(cents, currency)}
    </button>
  );
}

function RecurringRow({ line, plan, handlers }: { line: PlanLine; plan: PlanResponse; handlers: PlanLineHandlers }) {
  const { mutate: updateOccurrence, isPending } = useUpdateOccurrence(line.sourceId);
  const change = (data: Parameters<typeof updateOccurrence>[0]['data'], message: string) =>
    updateOccurrence(
      { expectedDate: line.cycleDate!, data },
      { onSuccess: () => toast.success(message), onError: (error) => toast.error(error.message) },
    );

  const paid = line.status === 'paid';
  const skipped = line.status === 'skipped';

  return (
    <LineShell
      line={line}
      checked={paid}
      disabled={isPending || skipped}
      onCheckedChange={(checked) =>
        change(checked ? { status: 'paid', actualDate: settleDay(plan) } : { status: 'pending' }, checked ? 'Marked paid' : 'Marked not paid')}
      checkboxLabel={paid ? `Mark ${line.label} not paid` : `Mark ${line.label} paid`}
      onLabelClick={() => handlers.onOpenBill(line.sourceId)}
      badges={
        <>
          {line.paidVia === 'assumed' && paid && <Badge variant="secondary">Assumed paid</Badge>}
          {line.paidVia === 'receipt' && paid && (
            <Badge variant="outline"><ReceiptIcon className="mr-1 h-3 w-3" />Receipt</Badge>
          )}
          {line.status === 'overdue' && <Badge variant="destructive">Overdue</Badge>}
          {line.estimated && !paid && <Badge variant="outline">Estimate</Badge>}
          {skipped && <Badge variant="outline">Skipped</Badge>}
        </>
      }
      detail={line.paymentMethod ? METHOD_LABEL[line.paymentMethod] : undefined}
      amount={
        <AmountEditor
          cents={line.amountCents}
          currency={line.currency}
          estimated={line.estimated && !paid}
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

function EntryRow({ line, viewerId, handlers }: { line: PlanLine; viewerId: string; handlers: PlanLineHandlers }) {
  const { mutate: updateEntry, isPending } = useUpdateEntry();
  const { mutate: deleteEntry } = useDeleteEntry();
  const isOwner = line.ownerUserId === viewerId;

  return (
    <LineShell
      line={line}
      checked={line.status === 'done'}
      disabled={isPending}
      onCheckedChange={(done) => updateEntry({ id: line.sourceId, data: { done } }, { onError: (error) => toast.error(error.message) })}
      onLabelClick={isOwner ? () => handlers.onEditEntry(line) : undefined}
      detail={line.category ?? undefined}
      amount={
        <AmountEditor
          cents={line.amountCents}
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
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => deleteEntry(line.sourceId, {
              onSuccess: () => toast.success(`Removed ${line.label}`),
              onError: (error) => toast.error(error.message),
            })}
          >
            <Trash2 className="mr-2 h-4 w-4" />Remove
          </DropdownMenuItem>
        </>
      ) : undefined}
    />
  );
}

function GoalRow({ line, plan, handlers }: { line: PlanLine; plan: PlanResponse; handlers: PlanLineHandlers }) {
  const { mutate: addContribution, isPending: adding } = useAddContribution();
  const { mutate: removeContributions, isPending: removing } = useRemoveContributions();
  const done = line.status === 'done';

  return (
    <LineShell
      line={line}
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
      amount={
        <button type="button" onClick={() => handlers.onEditGoal(line.sourceId)} className="amount min-h-10 rounded-md px-2 text-right font-semibold tabular-nums hover:bg-accent">
          {formatCents(line.amountCents, line.currency)}
        </button>
      }
    />
  );
}

function IncomeRow({ line, handlers }: { line: PlanLine; handlers: PlanLineHandlers }) {
  return (
    <LineShell
      line={line}
      onLabelClick={line.source === 'income' ? () => handlers.onEditIncome(line.sourceId) : () => handlers.onEditEntry(line)}
      detail={line.status === 'paid' ? 'Arrived' : 'Due'}
      amount={
        <button
          type="button"
          onClick={line.source === 'income' ? () => handlers.onEditIncome(line.sourceId) : () => handlers.onEditEntry(line)}
          className="amount min-h-10 rounded-md px-2 text-right font-semibold tabular-nums text-success hover:bg-accent"
        >
          {formatCents(line.amountCents, line.currency)}
        </button>
      }
    />
  );
}

/** One row: tick-off box, label with date and badges, amount, and a menu. Sized for a thumb. */
function LineShell({
  line,
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
  return (
    <li className="flex items-center gap-3 py-2">
      {onCheckedChange ? (
        <Checkbox
          checked={checked}
          disabled={disabled}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          className="size-5"
          aria-label={checkboxLabel ?? (checked ? `Mark ${line.label} not done` : `Mark ${line.label} done`)}
        />
      ) : (
        <span className="size-5 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <button
          type="button"
          disabled={!onLabelClick}
          onClick={onLabelClick}
          className={cn('block max-w-full truncate text-left font-medium', struck && 'text-muted-foreground line-through', checked && 'text-muted-foreground')}
        >
          {line.label}
        </button>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{formatLocalDate(line.date, { day: 'numeric', month: 'short' })}</span>
          {detail && <span>· {detail}</span>}
          {line.notCountedReason === 'other_currency' && <span>· not counted ({line.currency})</span>}
          {badges}
        </div>
      </div>
      {amount}
      {menu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label={`More for ${line.label}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">{menu}</DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="w-10 shrink-0" />
      )}
    </li>
  );
}

function Section({ title, totalCents, currency, children }: { title: string; totalCents: number; currency: string; children: React.ReactNode }) {
  return (
    <Card data-private>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <span className="amount text-sm font-semibold text-muted-foreground">{formatCents(totalCents, currency)}</span>
      </CardHeader>
      <CardContent className="pt-2">
        <ul className="divide-y">{children}</ul>
      </CardContent>
    </Card>
  );
}

const sum = (lines: PlanLine[]) => lines.filter((line) => line.counted).reduce((total, line) => total + line.amountCents, 0);

export function PlanLines({ plan, viewerId, ...handlers }: PlanLinesProps) {
  const incoming = plan.lines.filter((line) => line.direction === 'in');
  const recurring = plan.lines.filter((line) => line.direction === 'out' && line.source === 'recurring');
  const goals = plan.lines.filter((line) => line.source === 'goal');
  const oneOffs = plan.lines.filter((line) => line.direction === 'out' && line.source === 'entry');
  const month = plan.period.label.split(' ')[0];

  return (
    <div className="space-y-4">
      {incoming.length > 0 && (
        <Section title="Coming in" totalCents={sum(incoming)} currency={plan.currency}>
          {incoming.map((line) => (line.source === 'entry'
            ? <EntryRow key={line.key} line={line} viewerId={viewerId} handlers={handlers} />
            : <IncomeRow key={line.key} line={line} handlers={handlers} />))}
        </Section>
      )}
      {recurring.length > 0 && (
        <Section title="Bills & subscriptions" totalCents={sum(recurring)} currency={plan.currency}>
          {recurring.map((line) => <RecurringRow key={line.key} line={line} plan={plan} handlers={handlers} />)}
        </Section>
      )}
      {goals.length > 0 && (
        <Section title="Savings" totalCents={sum(goals)} currency={plan.currency}>
          {goals.map((line) => <GoalRow key={line.key} line={line} plan={plan} handlers={handlers} />)}
        </Section>
      )}
      {oneOffs.length > 0 && (
        <Section title={`Just for ${month}`} totalCents={sum(oneOffs)} currency={plan.currency}>
          {oneOffs.map((line) => <EntryRow key={line.key} line={line} viewerId={viewerId} handlers={handlers} />)}
        </Section>
      )}
    </div>
  );
}
