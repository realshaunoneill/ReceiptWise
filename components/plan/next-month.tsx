'use client';

import { CalendarClock, ChevronRight } from 'lucide-react';
import { planBreakdown } from '@/shared/plan/breakdown';
import { formatCents } from '@/lib/utils/currency';
import { type PlanResponse } from '@/lib/services/plan-service';

/**
 * The month after the one on screen, at a glance, and a way into it: planning ahead (a bigger
 * credit card bill this month, so what's left next month) starts here. As on the app's Plan.
 */
export function NextMonth({ plan, onOpen }: { plan: PlanResponse | undefined; onOpen: () => void }) {
  if (!plan || plan.flags.includes('no_income')) return null;
  const breakdown = planBreakdown(plan.lines);
  const money = (cents: number) => formatCents(Math.abs(cents), plan.currency);
  const left = breakdown.leftCents < 0 ? `${money(breakdown.leftCents)} over` : `${money(breakdown.leftCents)} left`;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary"
      data-private
    >
      <CalendarClock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">Plan {plan.period.label.split(' ')[0]}</span>
        <span className="amount block text-sm text-muted-foreground">{left} · {money(breakdown.afterBillsCents)} after bills</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}
