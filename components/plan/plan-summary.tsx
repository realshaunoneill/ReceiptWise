'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { planNotes } from '@/lib/plan/plan-notes';
import { cn } from '@/lib/utils';
import { formatCents } from '@/lib/utils/currency';
import { type PlanResponse } from '@/lib/services/plan-service';

/**
 * The sheet's bottom line: what remains once everything planned has gone out, and that split
 * over the weeks of the period, with income and everything going out beside it.
 */
export function PlanSummary({ plan }: { plan: PlanResponse }) {
  const { totals, currency, period } = plan;
  const negative = totals.remainingCents < 0;
  const paidShare = totals.outgoingCents > 0 ? Math.round((totals.paidOutCents / totals.outgoingCents) * 100) : 0;
  const notes = planNotes(plan.lines);

  return (
    <Card data-private className="py-0">
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Remaining</p>
            <p className={cn('amount text-4xl font-semibold tracking-tight', negative && 'text-destructive')}>
              {formatCents(totals.remainingCents, currency)}
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

        <div className="grid grid-cols-2 gap-3 border-t pt-4 text-sm">
          <div>
            <p className="text-muted-foreground">Coming in</p>
            <p className="amount font-semibold">{formatCents(totals.incomeCents, currency)}</p>
          </div>
          {/* Everything going out: bills, savings and one-offs. "Bills total" read as the bills
              section's figure, which is only part of it. */}
          <div className="text-right">
            <p className="text-muted-foreground">Going out</p>
            <p className="amount font-semibold">{formatCents(totals.outgoingCents, currency)}</p>
          </div>
        </div>

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
