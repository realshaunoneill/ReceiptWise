import { type WirePlan } from '@shared/api/plan';
import { formatLocalDate, localToday } from '@shared/dates/local-date';

/** The day to record a payment or a new line on: today if it's in the period, else its first day. */
export function settleDay(plan: Pick<WirePlan, 'period'>): string {
  const today = localToday();
  return today >= plan.period.start && today < plan.period.end ? today : plan.period.start;
}

/** The day of the month a new monthly bill defaults to: the day it's added on (or the period's first). */
export function defaultBillDay(plan: Pick<WirePlan, 'period'>): number {
  return Number(settleDay(plan).slice(8, 10));
}

/** "October", from the period's label ("October 2026"). */
export const monthOf = (plan: Pick<WirePlan, 'period'>) => plan.period.label.split(' ')[0];

export const shortDay = (day: string) => formatLocalDate(day, { day: 'numeric', month: 'short' }, 'en-IE');
