import { addDays, daysBetween, type LocalDate } from '../dates/local-date';
import { planBreakdown } from './breakdown';
import { type PlanResult } from './compute-plan';

/**
 * The plan at a glance, for the home-screen widget (GET /api/plan/glance): what's left until
 * payday, after the bills, and the next few bills to pay. Small, so the widget's background
 * refresh is cheap, and enough to draw two weeks of the widget without asking again.
 */
export type PlanGlance = {
  currency: string;
  periodLabel: string;
  /** The next payday: the period's end. */
  payday: LocalDate;
  leftCents: number;
  afterBillsCents: number;
  weeklyCents: number;
  /** Unpaid bills from today on, soonest first, and any overdue (the widget shows three). */
  bills: Array<{ label: string; date: LocalDate; amountCents: number; estimated: boolean; overdue: boolean }>;
  /** When the figures were worked out, for the widget's "Updated Tue". */
  asOf: LocalDate;
};

export function planGlance(plan: Pick<PlanResult, 'currency' | 'period' | 'lines' | 'totals'>, today: LocalDate): PlanGlance {
  const breakdown = planBreakdown(plan.lines);
  const bills = plan.lines
    .filter((line) => line.source === 'recurring' && line.direction === 'out' && line.counted && line.status !== 'paid' && line.status !== 'skipped')
    .filter((line) => line.status === 'overdue' || line.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6)
    .map((line) => ({ label: line.label, date: line.date, amountCents: line.amountCents, estimated: line.estimated, overdue: line.status === 'overdue' }));
  return {
    currency: plan.currency,
    periodLabel: plan.period.label,
    payday: plan.period.end,
    leftCents: breakdown.leftCents,
    afterBillsCents: breakdown.afterBillsCents,
    weeklyCents: plan.totals.weeklyCents,
    bills,
    asOf: today,
  };
}

/** One day of the widget: drawn ahead, so the days count down without the app being opened. */
export type GlanceEntry = { date: LocalDate; daysToPayday: number; bills: PlanGlance['bills']; stale: boolean };

/**
 * Fourteen days of entries from a glance: each day's countdown to payday and the bills still to
 * come. Past payday, or after a week, the figures are marked stale ("Updated Tue") rather than
 * passed off as current.
 */
export function glanceTimeline(glance: PlanGlance, from: LocalDate, days = 14): GlanceEntry[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    return {
      date,
      daysToPayday: Math.max(0, daysBetween(date, glance.payday)),
      bills: glance.bills.filter((bill) => bill.overdue || bill.date >= date).slice(0, 3),
      stale: date >= glance.payday || daysBetween(glance.asOf, date) > 7,
    };
  });
}
