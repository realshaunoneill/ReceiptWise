import {
  addDays,
  daysBetween,
  daysInMonth,
  type LocalDate,
  previousBusinessDay,
  nextBusinessDay,
  toUtcDate,
  fromUtcDate,
} from '@/lib/dates/local-date';

/**
 * Paydays, and the plan's period: from one payday up to the next.
 *
 * All dates are calendar days (YYYY-MM-DD). A period is half-open, [start, end): it starts on a
 * payday and ends the day before the next one. With no income set, periods are calendar months.
 */

export const PAY_FREQUENCIES = ['monthly', 'last_working_day', 'weekly', 'fortnightly', 'four_weekly'] as const;
export type PayFrequency = typeof PAY_FREQUENCIES[number];

export const WEEKEND_RULES = ['previous_business_day', 'next_business_day', 'none'] as const;
export type WeekendRule = typeof WEEKEND_RULES[number];

export type PaySchedule = {
  frequency: string;
  payDay: number | null;
  anchorDate: LocalDate | null;
  weekendRule: string;
  endDate?: LocalDate | null;
};

export type Period = {
  /** The first day: a payday, or the 1st of the month without income. */
  start: LocalDate;
  /** The day after the last day: the next payday. */
  end: LocalDate;
  /** The month most of the period falls in, e.g. "November 2026": the month the money is spent in. */
  label: string;
  /** Whole weeks in the period (at least 1): 4 for any month. "Weekly split" divides by this. */
  weeks: number;
  /** True when there is no primary income and the period is just the calendar month. */
  calendarMonth: boolean;
  /**
   * Which recurring bills and paydays belong to the period (see inBucket). With monthly pay it is
   * the window between the paydays before any weekend or holiday move: the 25th up to the 24th,
   * even when the 25th was paid on Friday the 23rd. `start` and `end` stay the days the money
   * really comes, which decide which period today is in and when cash arrives. For weekly kinds
   * and calendar months it is just `start` and `end`.
   */
  bucket: { start: LocalDate; end: LocalDate; dayOfMonth: number | null };
};

const STEP_DAYS: Partial<Record<PayFrequency, number>> = { weekly: 7, fortnightly: 14, four_weekly: 28 };

function adjust(day: LocalDate, rule: string): LocalDate {
  if (rule === 'next_business_day') return nextBusinessDay(day);
  if (rule === 'none') return day;
  return previousBusinessDay(day);
}

function monthStart(day: LocalDate): { year: number; month: number } {
  const date = toUtcDate(day);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

function dayInMonth(year: number, month: number, day: number): LocalDate {
  const y = year + Math.floor(month / 12);
  const m = ((month % 12) + 12) % 12;
  return fromUtcDate(new Date(Date.UTC(y, m, Math.min(day, daysInMonth(y, m)))));
}

function frequencyOf(schedule: PaySchedule): PayFrequency {
  return (PAY_FREQUENCIES as readonly string[]).includes(schedule.frequency) ? schedule.frequency as PayFrequency : 'monthly';
}

/**
 * The day of the month a monthly schedule pays on before clamping and the weekend rule (31 for
 * the last working day), or null for the weekly kinds, which have no day of the month.
 */
export function monthlyPayDay(schedule: PaySchedule): number | null {
  const frequency = frequencyOf(schedule);
  if (frequency === 'last_working_day') return 31;
  if (frequency === 'monthly') return Math.min(Math.max(schedule.payDay || 1, 1), 31);
  return null;
}

export type Payday = {
  /** The day it is due by the schedule: the 25th, or the 31st clamped to the 30th. */
  due: LocalDate;
  /** The day it is paid, after the weekend and bank holiday rule. */
  paid: LocalDate;
};

/**
 * Paydays paid on a day d with from <= d < to, with the day each was due. A payday the weekend
 * rule moves into the range counts (the 1st on a Saturday paid on Friday the 31st is in December).
 */
export function paydaysDueAndPaid(schedule: PaySchedule, from: LocalDate, to: LocalDate): Payday[] {
  if (from >= to) return [];
  const frequency = frequencyOf(schedule);
  const nominal: LocalDate[] = [];

  if (frequency === 'monthly' || frequency === 'last_working_day') {
    // A month either side, so a payday moved across the boundary by the weekend rule is seen.
    const first = monthStart(addDays(from, -7));
    const last = monthStart(addDays(to, 7));
    const months = (last.year - first.year) * 12 + (last.month - first.month);
    for (let i = 0; i <= months; i++) {
      const month = first.month + i;
      nominal.push(frequency === 'last_working_day'
        ? dayInMonth(first.year, month, 31)
        : dayInMonth(first.year, month, Math.min(Math.max(schedule.payDay || 1, 1), 31)));
    }
  } else {
    const step = STEP_DAYS[frequency]!;
    const anchor = schedule.anchorDate ?? from;
    const offset = Math.floor(daysBetween(anchor, addDays(from, -7)) / step);
    for (let day = addDays(anchor, offset * step); day < addDays(to, 7); day = addDays(day, step)) {
      nominal.push(day);
    }
  }

  const rule = frequency === 'last_working_day' ? 'previous_business_day' : schedule.weekendRule;
  const seen = new Set<LocalDate>();
  return nominal
    .map((due) => ({ due, paid: adjust(due, rule) }))
    .filter(({ paid }) => !seen.has(paid) && seen.add(paid))
    .filter(({ paid }) => paid >= from && paid < to && (!schedule.endDate || paid <= schedule.endDate))
    .sort((a, b) => a.paid.localeCompare(b.paid));
}

/** Paydays d with from <= d < to, after the weekend and bank holiday rule is applied. */
export function paydaysBetween(schedule: PaySchedule, from: LocalDate, to: LocalDate): LocalDate[] {
  return paydaysDueAndPaid(schedule, from, to).map(({ paid }) => paid);
}

function monthLabel(start: LocalDate, end: LocalDate): string {
  // The month holding most of the period's days (ties go to the earlier month).
  const counts = new Map<string, number>();
  for (let day = start; day < end; day = addDays(day, 1)) {
    const key = day.slice(0, 7);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [year, month] = (best?.[0] ?? start.slice(0, 7)).split('-').map(Number);
  return new Intl.DateTimeFormat('en-IE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

function makePeriod(start: LocalDate, end: LocalDate, calendarMonth: boolean, bucket?: Period['bucket']): Period {
  return {
    start,
    end,
    label: monthLabel(start, end),
    weeks: Math.max(1, Math.floor(daysBetween(start, end) / 7)),
    calendarMonth,
    bucket: bucket ?? { start, end, dayOfMonth: null },
  };
}

function calendarPeriod(day: LocalDate): Period {
  const { year, month } = monthStart(day);
  return makePeriod(dayInMonth(year, month, 1), dayInMonth(year, month + 1, 1), true);
}

/**
 * The period containing `day`: from the latest payday on or before it to the next payday.
 *
 * With monthly pay, what belongs to it is bucketed by the paydays as due, not as paid. Bucketing
 * by the paid days stretched a period to 33 days when the 25th fell on a Sunday and was paid on
 * the Friday: bills on the 23rd and 24th then fell in November twice and not in October at all.
 * The weekly kinds keep the paid days: their anchor is a real payday, which may itself have been
 * moved, so there is no reliable "as due" day to step from.
 */
export function periodContaining(schedule: PaySchedule | null, day: LocalDate): Period {
  if (!schedule) return calendarPeriod(day);

  // Wide enough for a monthly schedule's previous and next paydays either side of `day`.
  const around = paydaysDueAndPaid(schedule, addDays(day, -70), addDays(day, 70));
  const start = [...around].reverse().find((payday) => payday.paid <= day);
  const end = around.find((payday) => payday.paid > day);
  if (!start || !end) return calendarPeriod(day);
  const dayOfMonth = monthlyPayDay(schedule);
  return makePeriod(start.paid, end.paid, false, dayOfMonth === null
    ? undefined
    : { start: start.due, end: end.due, dayOfMonth });
}

/**
 * A day as a position in a calendar where every month has 31 days. A clamped date, the last day
 * of a short month standing in for a later `dayOfMonth`, takes that day's place: a bill on the
 * 31st paid on 30 November then sorts after one on the 30th, as it does in a long month.
 */
function monthPosition(day: LocalDate, dayOfMonth?: number | null): number {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const date = Number(day.slice(8, 10));
  const clamped = dayOfMonth && dayOfMonth > date && date === daysInMonth(year, month - 1);
  return (year * 12 + month) * 32 + (clamped ? dayOfMonth : date);
}

/**
 * Whether something on `day` belongs to the period: a payday by the day it was due, a bill by
 * its cycle or due date. Pass `dayOfMonth` for anything that repeats on a day of the month (a
 * bill's billing day, an income's pay day), so one clamped to a short month still lands in the
 * right period: with pay on the 31st, each period then holds exactly one bill on the 30th.
 */
export function inBucket(period: Period, day: LocalDate, dayOfMonth?: number | null): boolean {
  const { bucket } = period;
  if (bucket.dayOfMonth === null) return day >= bucket.start && day < bucket.end;
  const position = monthPosition(day, dayOfMonth);
  return position >= monthPosition(bucket.start, bucket.dayOfMonth) && position < monthPosition(bucket.end, bucket.dayOfMonth);
}

/** The period `offset` periods after (or before, if negative) the one containing `day`. */
export function periodAt(schedule: PaySchedule | null, day: LocalDate, offset: number): Period {
  let period = periodContaining(schedule, day);
  for (let i = 0; i < Math.abs(offset); i++) {
    period = offset > 0
      ? periodContaining(schedule, period.end)
      : periodContaining(schedule, addDays(period.start, -1));
  }
  return period;
}
