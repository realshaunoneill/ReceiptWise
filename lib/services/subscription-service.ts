import { db } from '@/lib/db';
import { subscriptions, subscriptionPayments, type Subscription, type SubscriptionPayment } from '@/lib/db/schema';
import { eq, and, lt, inArray } from 'drizzle-orm';
import { BillingSchedule, DAY_MS, type ScheduleFields, utcDay } from '@/lib/schedule/billing-schedule';

/** A pending payment only becomes "missed" this long after its expected date. */
const MISSED_GRACE_DAYS = 3;

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
