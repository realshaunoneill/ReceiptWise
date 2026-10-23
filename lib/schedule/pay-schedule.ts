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

/**
 * Paydays d with from <= d < to, after the weekend rule is applied. A payday the weekend rule
 * moves into the range counts (the 1st on a Saturday paid on Friday the 31st is in December).
 */
export function paydaysBetween(schedule: PaySchedule, from: LocalDate, to: LocalDate): LocalDate[] {
  if (from >= to) return [];
  const frequency = (PAY_FREQUENCIES as readonly string[]).includes(schedule.frequency)
    ? schedule.frequency as PayFrequency
    : 'monthly';
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
  const adjusted = [...new Set(nominal.map((day) => adjust(day, rule)))].sort();
  return adjusted.filter((day) => day >= from && day < to && (!schedule.endDate || day <= schedule.endDate));
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

function makePeriod(start: LocalDate, end: LocalDate, calendarMonth: boolean): Period {
  return {
    start,
    end,
    label: monthLabel(start, end),
    weeks: Math.max(1, Math.floor(daysBetween(start, end) / 7)),
    calendarMonth,
  };
}

function calendarPeriod(day: LocalDate): Period {
  const { year, month } = monthStart(day);
  return makePeriod(dayInMonth(year, month, 1), dayInMonth(year, month + 1, 1), true);
}

/** The period containing `day`: from the latest payday on or before it to the next payday. */
export function periodContaining(schedule: PaySchedule | null, day: LocalDate): Period {
  if (!schedule) return calendarPeriod(day);

  // Wide enough for a monthly schedule's previous and next paydays either side of `day`.
  const around = paydaysBetween(schedule, addDays(day, -70), addDays(day, 70));
  const start = [...around].reverse().find((payday) => payday <= day);
  const end = around.find((payday) => payday > day);
  if (!start || !end) return calendarPeriod(day);
  return makePeriod(start, end, false);
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
