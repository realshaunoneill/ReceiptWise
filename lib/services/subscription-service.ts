import { db } from '@/lib/db';
import {
  subscriptions,
  subscriptionPayments,
  type Receipt,
  type Subscription,
  type SubscriptionPayment,
} from '@/lib/db/schema';
import { eq, and, gt, inArray, isNull, lte, or } from 'drizzle-orm';
import { fromUtcDate, nextBusinessDay, toUtcDate } from '@/lib/dates/local-date';
import { BillingSchedule, DAY_MS, type ScheduleFields, utcDay } from '@/lib/schedule/billing-schedule';
import { type UpdatePaymentInput } from '@/lib/validation/finance';

/** A pending payment only becomes "missed" this long after its expected date. */
const MISSED_GRACE_DAYS = 3;

/** Payment methods that take the money without the user doing anything. */
const AUTOMATIC_METHODS = ['direct_debit', 'standing_order'];

/** Statuses that mean a cycle is dealt with, so it is never the "next" billing date. */
const SETTLED_STATUSES = ['paid', 'skipped', 'cancelled'];

/** Subscriptions handled per batch by the daily run. */
const DAILY_BATCH_SIZE = 500;

type NewPayment = {
  subscriptionId: string;
  expectedDate: Date;
  expectedAmount: string;
  status: string;
};

/** The day a payment actually leaves the account: a bill's own due date if it has one, else the cycle date. */
function nominalDay(payment: Pick<SubscriptionPayment, 'dueDate' | 'expectedDate'>): string {
  return payment.dueDate ?? fromUtcDate(new Date(payment.expectedDate));
}

/**
 * When a direct debit or standing order is collected: its due day, or the next business day if
 * that falls on a weekend. Bank holidays are not modelled yet.
 */
export function collectionDay(payment: Pick<SubscriptionPayment, 'dueDate' | 'expectedDate'>): string {
  return nextBusinessDay(nominalDay(payment));
}

export class SubscriptionService {
  /**
   * The next billing date for a subscription as of `now`: the first cycle on or after today
   * that hasn't already been settled (paid, skipped or cancelled). Previously nextBillingDate was
   * set once to start + one period and only moved when a payment was marked paid, so any
   * subscription more than a period old showed a date in the past and dropped out of "upcoming".
   */
  static computeNextBillingDate(
    subscription: ScheduleFields,
    settledDates: Date[] = [],
    now: Date = new Date(),
  ): Date {
    const schedule = new BillingSchedule(subscription);
    const tolerance = schedule.matchToleranceMs;
    let from = utcDay(now);

    for (let i = 0; i < 24; i++) {
      const next = schedule.firstCycleOnOrAfter(from);
      if (!next) break;
      const settled = settledDates.some((d) => Math.abs(utcDay(new Date(d)).getTime() - next.getTime()) <= tolerance);
      if (!settled) return next;
      from = new Date(next.getTime() + DAY_MS);
    }

    // Ended (or everything ahead is settled): keep the last cycle so the column stays non-null.
    return schedule.cyclesThrough(utcDay(now)).at(-1) ?? schedule.cycle(0);
  }

  private static settledDates(existing: SubscriptionPayment[]): Date[] {
    return existing
      .filter((p) => SETTLED_STATUSES.includes(p.status))
      .map((p) => new Date(p.expectedDate));
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

    const nextBillingDate = this.computeNextBillingDate(subscription, this.settledDates(existing), now);

    return { toCreate, nextBillingDate };
  }

  /**
   * Generate expected payments for a subscription, for billing cycles up to today only (never
   * future ones), and bring its nextBillingDate up to date.
   */
  static async generateExpectedPayments(subscriptionId: string): Promise<number> {
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
   *
   * The insert ignores conflicts, so once the (subscription_id, expected_date) unique index is
   * in place two runs at once cannot create the same cycle twice. Before it, this ran on every
   * list request with no lock, which is how duplicate rows got in.
   */
  static async generateExpectedPaymentsBatch(
    subscriptionList: Subscription[],
    now: Date = new Date(),
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

    let created = 0;
    if (allPaymentsToCreate.length > 0) {
      const inserted = await db
        .insert(subscriptionPayments)
        .values(allPaymentsToCreate)
        .onConflictDoNothing()
        .returning({ id: subscriptionPayments.id });
      created = inserted.length;
    }

    for (const [id, nextBillingDate] of nextBillingDates) {
      await db
        .update(subscriptions)
        .set({ nextBillingDate, updatedAt: new Date() })
        .where(eq(subscriptions.id, id));
    }

    return { created, nextBillingDates };
  }

  /** Recompute and store one subscription's nextBillingDate from its settled cycles. */
  static async refreshNextBillingDate(subscriptionId: string, now: Date = new Date()): Promise<void> {
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1);
    if (!subscription) return;

    const existing = await db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.subscriptionId, subscriptionId));
    const nextBillingDate = this.computeNextBillingDate(subscription, this.settledDates(existing), now);

    if (new Date(subscription.nextBillingDate).getTime() !== nextBillingDate.getTime()) {
      await db
        .update(subscriptions)
        .set({ nextBillingDate, updatedAt: new Date() })
        .where(eq(subscriptions.id, subscriptionId));
    }
  }

  /**
   * Mark the cycles from `from` to `to` (inclusive) as skipped: the time a subscription was
   * paused. Cycles with no row get a 'skipped' one; pending or missed rows in the window become
   * 'skipped'. Paid rows are left alone. Without this, resuming backfilled every paused cycle as
   * pending and they all turned "missed" three days later.
   */
  static async skipCyclesBetween(subscription: Subscription, from: Date, to: Date): Promise<number> {
    const start = utcDay(from);
    const end = utcDay(to);
    if (start > end) return 0;

    const schedule = new BillingSchedule(subscription);
    const tolerance = schedule.matchToleranceMs;
    const existing = await db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.subscriptionId, subscription.id));

    const toSkip = existing
      .filter((p) => (p.status === 'pending' || p.status === 'missed'))
      .filter((p) => {
        const day = utcDay(new Date(p.expectedDate));
        return day >= start && day <= end;
      })
      .map((p) => p.id);

    const existingDays = existing.map((p) => utcDay(new Date(p.expectedDate)).getTime());
    const cycles = schedule.cyclesBetween(new Date(start.getTime() - 1), new Date(end.getTime() + 1));
    const toCreate = cycles
      .filter((date) => !existingDays.some((day) => Math.abs(day - date.getTime()) <= tolerance))
      .map((date) => ({
        subscriptionId: subscription.id,
        expectedDate: date,
        expectedAmount: subscription.amount,
        status: 'skipped',
      }));

    if (toSkip.length > 0) {
      await db
        .update(subscriptionPayments)
        .set({ status: 'skipped', updatedAt: new Date() })
        .where(inArray(subscriptionPayments.id, toSkip));
    }
    if (toCreate.length > 0) {
      await db.insert(subscriptionPayments).values(toCreate).onConflictDoNothing();
    }
    return toSkip.length + toCreate.length;
  }

  /**
   * When a payment is marked as paid, record it and move nextBillingDate to the next unsettled
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
    } else {
      await this.refreshNextBillingDate(subscriptionId);
    }
  }

  /**
   * Apply a change to one occurrence: link a receipt, mark it paid, skipped or back to pending,
   * or set its amount or due date. Shared by PATCH /api/subscriptions/payments/[id] and
   * PUT /api/subscriptions/[id]/occurrences.
   *
   * Marking paid without a receipt defaults to today and the expected amount: direct debits
   * have no receipt, and before this the only way to clear one was to link one.
   */
  static async applyPaymentChange(
    payment: SubscriptionPayment,
    input: UpdatePaymentInput,
    actorUserId: string,
    receipt?: Receipt,
  ): Promise<SubscriptionPayment> {
    const now = new Date();
    const updates: Partial<typeof subscriptionPayments.$inferInsert> = { updatedAt: now };

    if (input.expectedAmount !== undefined) {
      updates.expectedAmount = input.expectedAmount;
      updates.amountSource = 'manual';
    }
    if (input.dueDate !== undefined) updates.dueDate = input.dueDate;
    if (input.notes !== undefined) updates.notes = input.notes;

    if (receipt) {
      updates.receiptId = receipt.id;
      updates.status = input.status ?? 'paid';
      updates.actualDate = input.actualDate
        ?? (receipt.transactionDate && !Number.isNaN(new Date(receipt.transactionDate).getTime())
          ? utcDay(new Date(receipt.transactionDate))
          : utcDay(now));
      updates.actualAmount = input.actualAmount ?? receipt.totalAmount ?? payment.expectedAmount;
      updates.paidVia = 'receipt';
      updates.markedByUserId = actorUserId;
    } else if (input.status !== undefined) {
      updates.status = input.status;
      updates.markedByUserId = actorUserId;
      if (input.status === 'paid') {
        updates.actualDate = input.actualDate ?? payment.actualDate ?? utcDay(now);
        updates.actualAmount = input.actualAmount ?? payment.actualAmount ?? updates.expectedAmount ?? payment.expectedAmount;
        updates.paidVia = payment.receiptId ? 'receipt' : 'manual';
      } else {
        // Leaving 'paid' (Undo on an assumed direct debit, or a mistake): forget how it was paid,
        // including any linked receipt, so the row doesn't say pending and paid at once.
        updates.actualDate = input.actualDate ?? null;
        updates.actualAmount = input.actualAmount ?? null;
        updates.paidVia = null;
        updates.receiptId = null;
      }
    } else {
      if (input.actualDate !== undefined) updates.actualDate = input.actualDate;
      if (input.actualAmount !== undefined) updates.actualAmount = input.actualAmount;
    }

    const [updated] = await db
      .update(subscriptionPayments)
      .set(updates)
      .where(eq(subscriptionPayments.id, payment.id))
      .returning();

    if (updated.status === 'paid' && updated.actualDate) {
      await this.handlePaymentPaid(updated.subscriptionId, new Date(updated.actualDate));
    } else if (payment.status !== updated.status) {
      await this.refreshNextBillingDate(updated.subscriptionId);
    }

    return updated;
  }

  /**
   * Find the row for one cycle of a subscription, creating it if it has none. Used to act on an
   * occurrence that hasn't come round yet (set next month's bill amount, skip next month), which
   * the daily run would otherwise only create on the day. Returns null if `cycleDay` is not one of
   * the subscription's cycles.
   */
  static async findOrCreateOccurrence(subscription: Subscription, cycleDay: string): Promise<SubscriptionPayment | null> {
    const schedule = new BillingSchedule(subscription);
    const tolerance = schedule.matchToleranceMs;
    const target = toUtcDate(cycleDay);

    const existing = await db
      .select()
      .from(subscriptionPayments)
      .where(eq(subscriptionPayments.subscriptionId, subscription.id));
    const match = existing.find((p) => Math.abs(utcDay(new Date(p.expectedDate)).getTime() - target.getTime()) <= tolerance);
    if (match) return match;

    const window = Math.max(tolerance, 0);
    const [cycle] = schedule.cyclesBetween(new Date(target.getTime() - window - 1), new Date(target.getTime() + window + 1));
    if (!cycle) return null;

    const [created] = await db
      .insert(subscriptionPayments)
      .values({ subscriptionId: subscription.id, expectedDate: cycle, expectedAmount: subscription.amount, status: 'pending' })
      .onConflictDoNothing()
      .returning();
    if (created) return created;

    // Lost a race with another writer (only possible once the unique index exists): use theirs.
    const [raced] = await db
      .select()
      .from(subscriptionPayments)
      .where(and(eq(subscriptionPayments.subscriptionId, subscription.id), eq(subscriptionPayments.expectedDate, cycle)))
      .limit(1);
    return raced ?? null;
  }

  /**
   * The daily job (/api/cron/bills-daily):
   *   1. create the rows for cycles that came round, and correct nextBillingDate;
   *   2. mark direct debits and standing orders paid once their collection day arrives ("assumed",
   *      which the UI offers to undo): nobody confirms those, and they are the most common bills;
   *   3. mark everything else missed once it is MISSED_GRACE_DAYS overdue.
   */
  static async runDaily(now: Date = new Date()): Promise<{ created: number; assumedPaid: number; missed: number }> {
    let created = 0;
    let lastId: string | null = null;
    for (;;) {
      const batch: Subscription[] = await db
        .select()
        .from(subscriptions)
        .where(lastId ? and(eq(subscriptions.status, 'active'), gt(subscriptions.id, lastId)) : eq(subscriptions.status, 'active'))
        .orderBy(subscriptions.id)
        .limit(DAILY_BATCH_SIZE);
      if (batch.length === 0) break;
      created += (await this.generateExpectedPaymentsBatch(batch, now)).created;
      lastId = batch[batch.length - 1].id;
      if (batch.length < DAILY_BATCH_SIZE) break;
    }

    const today = fromUtcDate(now);
    const pending = await db
      .select({ payment: subscriptionPayments, paymentMethod: subscriptions.paymentMethod })
      .from(subscriptionPayments)
      .innerJoin(subscriptions, eq(subscriptions.id, subscriptionPayments.subscriptionId))
      .where(and(
        eq(subscriptionPayments.status, 'pending'),
        // Rows only exist up to today, except future ones a bill or the user created; a bill's
        // due date can sit a little after its cycle date, so look a few weeks ahead.
        lte(subscriptionPayments.expectedDate, new Date(now.getTime() + 31 * DAY_MS)),
      ));

    const assumed = pending.filter((row) =>
      row.paymentMethod && AUTOMATIC_METHODS.includes(row.paymentMethod) && collectionDay(row.payment) <= today);
    for (const { payment } of assumed) {
      await db
        .update(subscriptionPayments)
        .set({
          status: 'paid',
          paidVia: 'assumed',
          actualDate: toUtcDate(collectionDay(payment)),
          actualAmount: payment.expectedAmount,
          updatedAt: new Date(),
        })
        .where(and(eq(subscriptionPayments.id, payment.id), eq(subscriptionPayments.status, 'pending')));
    }
    for (const subscriptionId of new Set(assumed.map(({ payment }) => payment.subscriptionId))) {
      const latest = assumed
        .filter(({ payment }) => payment.subscriptionId === subscriptionId)
        .map(({ payment }) => toUtcDate(collectionDay(payment)))
        .sort((a, b) => b.getTime() - a.getTime())[0];
      await this.handlePaymentPaid(subscriptionId, latest);
    }

    const missedCutoff = fromUtcDate(new Date(now.getTime() - MISSED_GRACE_DAYS * DAY_MS));
    const missedIds = pending
      .filter((row) => !(row.paymentMethod && AUTOMATIC_METHODS.includes(row.paymentMethod)))
      .filter((row) => nominalDay(row.payment) < missedCutoff)
      .map((row) => row.payment.id);
    if (missedIds.length > 0) {
      await db
        .update(subscriptionPayments)
        .set({ status: 'missed', updatedAt: new Date() })
        .where(and(inArray(subscriptionPayments.id, missedIds), eq(subscriptionPayments.status, 'pending')));
    }

    return { created, assumedPaid: assumed.length, missed: missedIds.length };
  }

  /**
   * Whether an occurrence counts as missing its payment: missed, or pending past the grace
   * period. Counting plain 'pending' (as the list used to) flagged a payment due today as
   * missing, and without the daily run nothing ever became 'missed' in dev or preview. Direct
   * debits and standing orders are never overdue: they are assumed paid once collected.
   */
  static isOverdue(
    payment: Pick<SubscriptionPayment, 'status' | 'dueDate' | 'expectedDate'>,
    now: Date = new Date(),
    paymentMethod?: string | null,
  ): boolean {
    if (payment.status === 'missed') return true;
    if (payment.status !== 'pending') return false;
    // A direct debit or standing order goes out on its own; the daily run marks it assumed paid.
    if (paymentMethod && AUTOMATIC_METHODS.includes(paymentMethod)) return false;
    return nominalDay(payment) < fromUtcDate(new Date(now.getTime() - MISSED_GRACE_DAYS * DAY_MS));
  }

  /** Personal-or-shared row lookup without any access decision; callers apply finance-access rules. */
  static async getById(subscriptionId: string): Promise<Subscription | null> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1);
    return subscription ?? null;
  }

  /** A payment row with its subscription, or null. */
  static async getPaymentWithSubscription(paymentId: string): Promise<{ payment: SubscriptionPayment; subscription: Subscription } | null> {
    const [row] = await db
      .select()
      .from(subscriptionPayments)
      .innerJoin(subscriptions, eq(subscriptionPayments.subscriptionId, subscriptions.id))
      .where(eq(subscriptionPayments.id, paymentId))
      .limit(1);
    return row ? { payment: row.subscription_payments, subscription: row.subscriptions } : null;
  }

  /** Delete the unsettled, estimate-only rows so a changed schedule can regenerate them. */
  static async dropRegenerableRows(subscriptionId: string): Promise<void> {
    await db
      .delete(subscriptionPayments)
      .where(and(
        eq(subscriptionPayments.subscriptionId, subscriptionId),
        inArray(subscriptionPayments.status, ['pending', 'missed']),
        eq(subscriptionPayments.amountSource, 'estimate'),
        isNull(subscriptionPayments.receiptId),
        or(isNull(subscriptionPayments.notes), eq(subscriptionPayments.notes, '')),
      ));
  }

  /** Copy a new usual amount onto the unsettled rows that were only ever an estimate. */
  static async updateEstimatedAmounts(subscriptionId: string, amount: string): Promise<void> {
    await db
      .update(subscriptionPayments)
      .set({ expectedAmount: amount, updatedAt: new Date() })
      .where(and(
        eq(subscriptionPayments.subscriptionId, subscriptionId),
        inArray(subscriptionPayments.status, ['pending', 'missed']),
        eq(subscriptionPayments.amountSource, 'estimate'),
      ));
  }
}
