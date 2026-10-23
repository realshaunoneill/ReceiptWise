import { type Subscription } from '@/lib/db/schema';

export const BILLING_FREQUENCIES = ['monthly', 'bimonthly', 'quarterly', 'six_monthly', 'yearly', 'custom', 'once'] as const;
export type BillingFrequency = typeof BILLING_FREQUENCIES[number];

export function isBillingFrequency(value: unknown): value is BillingFrequency {
  return typeof value === 'string' && (BILLING_FREQUENCIES as readonly string[]).includes(value);
}

export const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS_PER_CYCLE: Record<Exclude<BillingFrequency, 'custom' | 'once'>, number> = {
  monthly: 1,
  bimonthly: 2, // every two months: how Irish electricity and gas bills come
  quarterly: 3,
  six_monthly: 6,
  yearly: 12,
};

/** Upper bound on cycles returned for one subscription in one call. */
const MAX_CYCLES = 600;

export type ScheduleFields = Pick<Subscription, 'startDate' | 'billingFrequency' | 'billingDay' | 'customFrequencyDays' | 'endDate'>;

/** Midnight UTC of the given instant's UTC calendar day. */
export function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysInMonthUTC(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** The given day of a month, clamped to the month's length (31 → Feb 28/29 → Mar 31). */
function dayOfMonthUTC(year: number, month: number, day: number): Date {
  const normalizedYear = year + Math.floor(month / 12);
  const normalizedMonth = ((month % 12) + 12) % 12;
  return new Date(Date.UTC(
    normalizedYear,
    normalizedMonth,
    Math.min(day, daysInMonthUTC(normalizedYear, normalizedMonth)),
  ));
}

/**
 * Billing schedule for a tracked subscription or bill.
 *
 * Cycles fall on `billingDay` ("What day of the month?"), starting with the first such day on
 * or after `startDate` ("When did you start?"), clamped to short months. Each cycle is derived
 * from the anchor rather than from the previous cycle, so a 31st goes Jan 31 → Feb 28 → Mar 31
 * instead of drifting to the 28th for ever — which is what the old step-from-previous-date maths
 * did, while ignoring billingDay entirely. Custom frequencies repeat every N days from the start.
 * A one-off ('once') has a single cycle, on the start date itself.
 */
export class BillingSchedule {
  private readonly start: Date;
  private readonly frequency: BillingFrequency;
  private readonly billingDay: number;
  private readonly customDays: number;
  private readonly end: Date | null;
  private readonly anchor: Date;

  constructor(subscription: ScheduleFields) {
    this.start = utcDay(new Date(subscription.startDate));
    this.frequency = isBillingFrequency(subscription.billingFrequency) ? subscription.billingFrequency : 'monthly';
    this.billingDay = Math.min(Math.max(subscription.billingDay || this.start.getUTCDate(), 1), 31);
    this.customDays = Math.max(subscription.customFrequencyDays || 30, 1);
    this.end = subscription.endDate ? utcDay(new Date(subscription.endDate)) : null;

    if (this.frequency === 'custom' || this.frequency === 'once') {
      this.anchor = this.start;
    } else {
      const inStartMonth = dayOfMonthUTC(this.start.getUTCFullYear(), this.start.getUTCMonth(), this.billingDay);
      this.anchor = inStartMonth >= this.start
        ? inStartMonth
        : dayOfMonthUTC(this.start.getUTCFullYear(), this.start.getUTCMonth() + 1, this.billingDay);
    }
  }

  /** Index of the final cycle, or Infinity for an open-ended schedule (end dates are applied separately). */
  private get lastIndex(): number {
    return this.frequency === 'once' ? 0 : Infinity;
  }

  /** The date of cycle `index` (0 = first payment). */
  cycle(index: number): Date {
    if (this.frequency === 'once') return this.anchor;
    if (this.frequency === 'custom') {
      return new Date(this.anchor.getTime() + index * this.customDays * DAY_MS);
    }
    const months = MONTHS_PER_CYCLE[this.frequency] * index;
    return dayOfMonthUTC(this.anchor.getUTCFullYear(), this.anchor.getUTCMonth() + months, this.billingDay);
  }

  /**
   * A cycle index at or just before the one nearest `date`, so walks can start near today
   * rather than at the first payment — a daily custom subscription a few years old has
   * thousands of cycles.
   */
  private indexNear(date: Date): number {
    if (this.frequency === 'once') return 0;
    if (this.frequency === 'custom') {
      return Math.max(0, Math.floor((date.getTime() - this.anchor.getTime()) / (this.customDays * DAY_MS)) - 1);
    }
    const monthsApart = (date.getUTCFullYear() - this.anchor.getUTCFullYear()) * 12
      + (date.getUTCMonth() - this.anchor.getUTCMonth());
    return Math.max(0, Math.floor(monthsApart / MONTHS_PER_CYCLE[this.frequency]) - 1);
  }

  private hasCycle(index: number): boolean {
    if (index < 0 || index > this.lastIndex) return false;
    return !this.end || this.cycle(index) <= this.end;
  }

  /**
   * Cycle dates up to and including `until` (and the end date, if set) — the most recent
   * MAX_CYCLES of them, oldest first.
   */
  cyclesThrough(until: Date): Date[] {
    const limit = this.end && this.end < until ? this.end : until;
    let last = Math.min(this.indexNear(limit), this.lastIndex);
    while (last + 1 <= this.lastIndex && this.cycle(last + 1) <= limit) last++;
    while (last >= 0 && this.cycle(last) > limit) last--;

    const dates: Date[] = [];
    for (let i = Math.max(0, last - MAX_CYCLES + 1); i <= last; i++) {
      dates.push(this.cycle(i));
    }
    return dates;
  }

  /**
   * Cycle dates strictly after `from` and strictly before `to`, oldest first, at most MAX_CYCLES.
   * Used for occurrences that have no row yet, such as the rest of a pay cycle.
   */
  cyclesBetween(from: Date, to: Date): Date[] {
    const dates: Date[] = [];
    for (let i = Math.min(this.indexNear(from), this.lastIndex); this.hasCycle(i) && dates.length < MAX_CYCLES; i++) {
      const date = this.cycle(i);
      if (date >= to) break;
      if (date > from) dates.push(date);
    }
    return dates;
  }

  /** The first cycle on or after `from`, or null once the schedule has ended. */
  firstCycleOnOrAfter(from: Date): Date | null {
    const target = utcDay(from);
    for (let i = this.indexNear(target); ; i++) {
      if (!this.hasCycle(i)) return null;
      const date = this.cycle(i);
      if (date >= target) return date;
    }
  }

  /**
   * How close an existing payment's expectedDate must be to a cycle date to count as that cycle.
   * Rows written by the old maths can sit a day or three off the corrected schedule; the window
   * stays under half a cycle so it can never swallow a neighbouring one.
   */
  get matchToleranceMs(): number {
    if (this.frequency === 'custom') {
      return Math.max(0, Math.floor((this.customDays - 1) / 2)) * DAY_MS;
    }
    return 3 * DAY_MS;
  }
}

/** Average days in a month, for turning a custom N-day frequency into a monthly figure. */
const DAYS_PER_MONTH = 365.25 / 12;

/**
 * The average monthly cost of a recurring amount: monthly ×1, quarterly ÷3, six-monthly ÷6,
 * yearly ÷12, custom N days × (days per month ÷ N). A one-off has no monthly cost. This is an
 * average, not what falls in any particular month.
 */
export function monthlyEquivalent(
  amount: number,
  billingFrequency: string,
  customFrequencyDays?: number | null,
): number {
  if (!Number.isFinite(amount)) return 0;
  switch (billingFrequency) {
    case 'monthly':
      return amount;
    case 'bimonthly':
      return amount / 2;
    case 'quarterly':
      return amount / 3;
    case 'six_monthly':
      return amount / 6;
    case 'yearly':
      return amount / 12;
    case 'custom':
      return (amount * DAYS_PER_MONTH) / Math.max(customFrequencyDays || 30, 1);
    case 'once':
      return 0;
    default:
      return amount;
  }
}

/** How often, for display after an amount: "€9.99 a month", "€120.00 every 6 months". */
export function frequencyLabel(billingFrequency: string, customFrequencyDays?: number | null): string {
  switch (billingFrequency) {
    case 'monthly':
      return 'a month';
    case 'bimonthly':
      return 'every 2 months';
    case 'quarterly':
      return 'a quarter';
    case 'six_monthly':
      return 'every 6 months';
    case 'yearly':
      return 'a year';
    case 'custom':
      return `every ${customFrequencyDays || 30} days`;
    case 'once':
      return 'once';
    default:
      return billingFrequency;
  }
}
