'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { planBreakdown } from '@/shared/plan/breakdown';
import { planNotes } from '@/lib/plan/plan-notes';
import { cn } from '@/lib/utils';
import { formatCents } from '@/lib/utils/currency';
import { type PlanResponse } from '@/lib/services/plan-service';

/**
 * The sheet's bottom line, and how it gets there in the order people work it out: what comes in,
 * the bills, what's left after the bills (the answer to "what have I got once the essentials are
 * paid?"), then subscriptions, savings and the month's one-offs, down to what remains and its
 * weekly split. The app's Plan shows the same breakdown (shared/plan/breakdown.ts).
 */
export function PlanSummary({ plan }: { plan: PlanResponse }) {
  const { totals, currency, period } = plan;
  const breakdown = planBreakdown(plan.lines);
  const negative = breakdown.leftCents < 0;
  const paidShare = totals.outgoingCents > 0 ? Math.round((totals.paidOutCents / totals.outgoingCents) * 100) : 0;
  const notes = planNotes(plan.lines, { estimates: false });
  const month = period.label.split(' ')[0];
  const current = plan.daysLeft !== null;
  const money = (cents: number) => formatCents(Math.abs(cents), currency);
  const rows: Array<{ label: string; cents: number; minus?: boolean; total?: boolean; hint?: string }> = [
    { label: 'Coming in', cents: breakdown.incomeCents },
    { label: 'Bills', cents: breakdown.billsCents, minus: true, hint: breakdown.estimated ? 'Includes estimates' : undefined },
    { label: 'After bills', cents: breakdown.afterBillsCents, total: true, hint: 'What you have once the bills are paid' },
    ...(breakdown.subscriptionsCents ? [{ label: 'Subscriptions', cents: breakdown.subscriptionsCents, minus: true }] : []),
    ...(breakdown.savingsCents ? [{ label: 'Savings', cents: breakdown.savingsCents, minus: true }] : []),
    ...(breakdown.oneOffsCents ? [{ label: `Just for ${month}`, cents: breakdown.oneOffsCents, minus: true }] : []),
  ];

  return (
    <Card data-private className="py-0">
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{negative ? `Over in ${month} by` : current ? 'Left this month' : `Left in ${month}`}</p>
            <p className={cn('amount text-4xl font-semibold tracking-tight', negative && 'text-destructive')}>
              {money(breakdown.leftCents)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Weekly split</p>
            <p className={cn('amount text-2xl font-semibold', negative && 'text-destructive')}>
              {formatCents(totals.weeklyCents, currency)}
            </p>
            <p className="text-xs text-muted-foreground">over {period.weeks} weeks</p>
          </div>
        </div>

        <dl className="border-t text-sm">
          {rows.map((row) => (
            <div
              key={row.label}
              className={cn('flex items-baseline justify-between gap-4 py-2', row.total && 'my-1 border-y py-2.5')}
            >
              <dt>
                <span className={cn(row.total ? 'font-semibold' : 'text-muted-foreground')}>{row.label}</span>
                {row.hint && <span className="block text-xs text-muted-foreground">{row.hint}</span>}
              </dt>
              <dd
                className={cn(
                  'amount font-semibold tabular-nums',
                  row.total && 'text-lg',
                  row.label === 'Coming in' && 'text-success',
                  row.total && row.cents < 0 && 'text-destructive',
                )}
              >
                <span className="sr-only">{row.minus ? 'minus ' : ''}</span>
                <span aria-hidden="true">{row.minus ? '− ' : ''}</span>
                {row.total && row.cents < 0 ? `${money(row.cents)} over` : money(row.cents)}
              </dd>
            </div>
          ))}
        </dl>

        {totals.outgoingCents > 0 && (
          <div className="space-y-1.5">
            <Progress value={paidShare} aria-label="Share of planned outgoings already paid" />
            <p className="amount text-xs text-muted-foreground">
              {formatCents(totals.paidOutCents, currency)} paid · {formatCents(totals.toGoCents, currency)} still to go
            </p>
          </div>
        )}

        {notes.length > 0 && <p className="text-xs text-muted-foreground">{notes.join(' · ')}</p>}
      </CardContent>
    </Card>
  );
}
