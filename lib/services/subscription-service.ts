import { db } from '@/lib/db';
import { subscriptions, subscriptionPayments, type Subscription, type SubscriptionPayment } from '@/lib/db/schema';
import { eq, and, lt, inArray } from 'drizzle-orm';

type BillingFrequency = 'monthly' | 'quarterly' | 'yearly' | 'custom';

const DAY_MS = 24 * 60 * 60 * 1000;

const MONTHS_PER_CYCLE: Record<Exclude<BillingFrequency, 'custom'>, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

/** A pending payment only becomes "missed" this long after its expected date. */
const MISSED_GRACE_DAYS = 3;

/** Upper bound on cycles generated for one subscription in one pass. */
const MAX_CYCLES = 600;

type ScheduleFields = Pick<Subscription, 'startDate' | 'billingFrequency' | 'billingDay' | 'customFrequencyDays' | 'endDate'>;

/** Midnight UTC of the given instant's UTC calendar day. */
function utcDay(date: Date): Date {
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
 * Billing schedule for a tracked subscription.
 *
 * Cycles fall on `billingDay` ("What day of the month?"), starting with the first such day on
 * or after `startDate` ("When did you start?"), clamped to short months. Each cycle is derived
 * from the anchor rather than from the previous cycle, so a 31st goes Jan 31 → Feb 28 → Mar 31
 * instead of drifting to the 28th for ever — which is what the old step-from-previous-date maths
 * did, while ignoring billingDay entirely. Custom frequencies repeat every N days from the start.
 */
class BillingSchedule {
  private readonly start: Date;
  private readonly frequency: BillingFrequency;
  private readonly billingDay: number;
  private readonly customDays: number;
  private readonly end: Date | null;
  private readonly anchor: Date;

  constructor(subscription: ScheduleFields) {
    this.start = utcDay(new Date(subscription.startDate));
    this.frequency = (subscription.billingFrequency as BillingFrequency) || 'monthly';
    this.billingDay = Math.min(Math.max(subscription.billingDay || this.start.getUTCDate(), 1), 31);
    this.customDays = Math.max(subscription.customFrequencyDays || 30, 1);
    this.end = subscription.endDate ? utcDay(new Date(subscription.endDate)) : null;

    if (this.frequency === 'custom') {
      this.anchor = this.start;
    } else {
      const inStartMonth = dayOfMonthUTC(this.start.getUTCFullYear(), this.start.getUTCMonth(), this.billingDay);
      this.anchor = inStartMonth >= this.start
        ? inStartMonth
        : dayOfMonthUTC(this.start.getUTCFullYear(), this.start.getUTCMonth() + 1, this.billingDay);
    }
  }

  /** The date of cycle `index` (0 = first payment). */
  cycle(index: number): Date {
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
    if (this.frequency === 'custom') {
      return Math.max(0, Math.floor((date.getTime() - this.anchor.getTime()) / (this.customDays * DAY_MS)) - 1);
    }
    const monthsApart = (date.getUTCFullYear() - this.anchor.getUTCFullYear()) * 12
      + (date.getUTCMonth() - this.anchor.getUTCMonth());
    return Math.max(0, Math.floor(monthsApart / MONTHS_PER_CYCLE[this.frequency]) - 1);
  }

  /**
   * Cycle dates up to and including `until` (and the end date, if set) — the most recent
   * MAX_CYCLES of them, oldest first.
   */
  cyclesThrough(until: Date): Date[] {
    const limit = this.end && this.end < until ? this.end : until;
    let last = this.indexNear(limit);
    while (this.cycle(last + 1) <= limit) last++;
    while (last >= 0 && this.cycle(last) > limit) last--;

    const dates: Date[] = [];
    for (let i = Math.max(0, last - MAX_CYCLES + 1); i <= last; i++) {
      dates.push(this.cycle(i));
    }
    return dates;
  }

  /** The first cycle on or after `from`, or null once the subscription has ended. */
  firstCycleOnOrAfter(from: Date): Date | null {
    const target = utcDay(from);
    for (let i = this.indexNear(target); ; i++) {
      const date = this.cycle(i);
      if (this.end && date > this.end) return null;
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

type NewPayment = {
  subscriptionId: string;
  expectedDate: Date;
  expectedAmount: string;
  status: string;
};

export class SubscriptionService {
  /**
   * The next billing date for a subscription as of `now`: the first cycle on or after today
   * that hasn't already been paid. Previously nextBillingDate was set once to start + one period
   * and only moved when a payment was marked paid, so any subscription more than a period old
   * showed a date in the past and dropped out of "upcoming".
   */
  static computeNextBillingDate(
    subscription: ScheduleFields,
    paidDates: Date[] = [],
    now: Date = new Date(),
  ): Date {
    const schedule = new BillingSchedule(subscription);
    const tolerance = schedule.matchToleranceMs;
    let from = utcDay(now);

    for (let i = 0; i < 24; i++) {
      const next = schedule.firstCycleOnOrAfter(from);
      if (!next) break;
      const alreadyPaid = paidDates.some((d) => Math.abs(utcDay(new Date(d)).getTime() - next.getTime()) <= tolerance);
      if (!alreadyPaid) return next;
      from = new Date(next.getTime() + DAY_MS);
    }

    // Ended (or everything ahead is paid): keep the last cycle so the column stays non-null.
    return schedule.cyclesThrough(utcDay(now)).at(-1) ?? schedule.cycle(0);
  }

  /**
   * Work out which expected-payment rows are missing for one subscription, and its correct
   * nextBillingDate, given all its existing payment rows.
   *
   * Existing rows of EVERY status count when deduplicating. The old code only looked at
   * pending/missed, so marking the last outstanding cycle paid made it regenerate every
   * historical cycle from the start date, which then all flipped to "missed" — the missed list
   * could never be cleared. A cycle that has any row (including one the user cancelled) is never
   * recreated.
   */
  private static planPayments(subscription: Subscription, existing: SubscriptionPayment[], now: Date) {
    const schedule = new BillingSchedule(subscription);
    const tolerance = schedule.matchToleranceMs;
    const existingDays = existing.map((p) => utcDay(new Date(p.expectedDate)).getTime());

    const toCreate: NewPayment[] = [];
    for (const date of schedule.cyclesThrough(utcDay(now))) {
      const covered = existingDays.some((day) => Math.abs(day - date.getTime()) <= tolerance);
      if (!covered) {
        toCreate.push({
          subscriptionId: subscription.id,
          expectedDate: date,
          expectedAmount: subscription.amount,
          status: 'pending',
        });
      }
    }

    const paidDates = existing
      .filter((p) => p.status === 'paid')
      .map((p) => new Date(p.expectedDate));
    const nextBillingDate = this.computeNextBillingDate(subscription, paidDates, now);

    return { toCreate, nextBillingDate };
  }

  /**
   * Generate expected payments for a subscription, for billing cycles up to today only (never
   * future ones), and bring its nextBillingDate up to date.
   */
  static async generateExpectedPayments(
    subscriptionId: string,
    _monthsAhead: number = 12,
    _generateHistorical: boolean = false,
  ): Promise<number> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1);

    if (!subscription || subscription.status !== 'active') {
      return 0;
    }

    const { created } = await this.generateExpectedPaymentsBatch([subscription]);
    return created;
  }

  /**
   * Generate expected payments for several subscriptions with one read and one insert, and
   * correct each one's nextBillingDate. Returns the corrected dates so a caller that already
   * holds the rows can patch them without re-reading.
   */
  static async generateExpectedPaymentsBatch(
    subscriptionList: Subscription[],
  ): Promise<{ created: number; nextBillingDates: Map<string, Date> }> {
    const nextBillingDates = new Map<string, Date>();
    const activeSubscriptions = subscriptionList.filter(sub => sub.status === 'active');

    if (activeSubscriptions.length === 0) {
      return { created: 0, nextBillingDates };
    }

    const subscriptionIds = activeSubscriptions.map(s => s.id);
    const allExistingPayments = await db
      .select()
      .from(subscriptionPayments)
      .where(inArray(subscriptionPayments.subscriptionId, subscriptionIds));

    const existingBySubscription = new Map<string, SubscriptionPayment[]>();
    for (const payment of allExistingPayments) {
      const list = existingBySubscription.get(payment.subscriptionId) || [];
      list.push(payment);
      existingBySubscription.set(payment.subscriptionId, list);
    }

    const now = new Date();
    const allPaymentsToCreate: NewPayment[] = [];

    for (const subscription of activeSubscriptions) {
      const { toCreate, nextBillingDate } = this.planPayments(
        subscription,
        existingBySubscription.get(subscription.id) || [],
        now,
      );
      allPaymentsToCreate.push(...toCreate);

      if (new Date(subscription.nextBillingDate).getTime() !== nextBillingDate.getTime()) {
        nextBillingDates.set(subscription.id, nextBillingDate);
      }
    }

    if (allPaymentsToCreate.length > 0) {
      await db.insert(subscriptionPayments).values(allPaymentsToCreate);
    }

    for (const [id, nextBillingDate] of nextBillingDates) {
      await db
        .update(subscriptions)
        .set({ nextBillingDate, updatedAt: new Date() })
        .where(eq(subscriptions.id, id));
    }

    return { created: allPaymentsToCreate.length, nextBillingDates };
  }

  /**
   * Mark a set of subscriptions' pending payments as missed once they are more than
   * MISSED_GRACE_DAYS past their expected date.
   *
   * Scoped to the given subscriptions. It used to be one UPDATE across every user's payments on
   * every GET /api/subscriptions (the call site's comment said "this user's"), with no grace
   * period — so a payment generated for today was "missed" the moment it was created.
   */
  static async updateMissedPayments(subscriptionIds: string[]): Promise<number> {
    if (subscriptionIds.length === 0) return 0;

    const cutoff = new Date(Date.now() - MISSED_GRACE_DAYS * DAY_MS);

    const result = await db
      .update(subscriptionPayments)
      .set({ status: 'missed', updatedAt: new Date() })
      .where(
        and(
          inArray(subscriptionPayments.subscriptionId, subscriptionIds),
          eq(subscriptionPayments.status, 'pending'),
          lt(subscriptionPayments.expectedDate, cutoff),
        ),
      )
      .returning({ id: subscriptionPayments.id });

    return result.length;
  }

  /**
   * When a payment is marked as paid, record it and move nextBillingDate to the next unpaid
   * cycle.
   */
  static async handlePaymentPaid(
    subscriptionId: string,
    paidDate: Date,
  ): Promise<void> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1);

    if (!subscription) {
      return;
    }

    const lastPaymentDate = subscription.lastPaymentDate && subscription.lastPaymentDate > paidDate
      ? subscription.lastPaymentDate
      : paidDate;

    await db
      .update(subscriptions)
      .set({ lastPaymentDate, updatedAt: new Date() })
      .where(eq(subscriptions.id, subscriptionId));

    if (subscription.status === 'active') {
      // Fills any gaps and recomputes nextBillingDate against the now-paid cycle.
      await this.generateExpectedPayments(subscriptionId);
    }
  }

  /**
   * Verify subscription ownership
   * Returns subscription if owned by user, null otherwise
   */
  static async getSubscriptionByIdAndUserId(
    subscriptionId: string,
    userId: string,
  ): Promise<Subscription | null> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.id, subscriptionId),
          eq(subscriptions.userId, userId),
        ),
      )
      .limit(1);

    return subscription || null;
  }

  /**
   * Verify subscription ownership and throw if not found
   * Returns the subscription or throws an error
   */
  static async requireSubscriptionOwnership(
    subscriptionId: string,
    userId: string,
  ): Promise<Subscription> {
    const subscription = await this.getSubscriptionByIdAndUserId(subscriptionId, userId);

    if (!subscription) {
      throw new Error('Subscription not found or access denied');
    }

    return subscription;
  }
}
