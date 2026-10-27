import { and, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { incomeSources, pushDevices, subscriptionPayments, subscriptions, type User, users } from '@/lib/db/schema';
import { isFeatureEnabled } from '@/lib/features';
import { type CorrelationId } from '@/lib/logging';
import { getFinanceEntitlements, hasAnyFinanceAccess } from '@/lib/services/finance-access';
import { loadPlan } from '@/lib/services/plan-service';
import { addDays, fromUtcDate, toUtcDate } from '@/shared/dates/local-date';
import { paydaysBetween } from '@/shared/schedule/pay-schedule';
import { billDue, billOverdue, isMorningRound, localClock, payday, validTimeZone } from './messages';
import { notify, type NotifyResult } from './send';

/**
 * The 9 am round (cron/notify, hourly: whoever's local time is 9 o'clock that hour): bills paid by
 * hand due tomorrow, ones gone overdue in the last week (once each), and payday with the new
 * month's figures. Only for people with a phone registered and the plan on their account.
 */
export async function morningRound(now: Date, correlationId: CorrelationId | null): Promise<Record<NotifyResult, number>> {
  const tally: Record<NotifyResult, number> = { sent: 0, held: 0, off: 0, 'no-device': 0, duplicate: 0, disabled: 0 };
  const count = (result: NotifyResult) => { tally[result]++; };

  const people = await db
    .selectDistinct({ user: users })
    .from(users)
    .innerJoin(pushDevices, and(eq(pushDevices.userId, users.id), isNull(pushDevices.disabledAt)));

  for (const { user } of people) {
    const timeZone = validTimeZone(user.timeZone);
    if (!isMorningRound(now, timeZone) || user.isBlocked || user.deletionScheduledAt) continue;
    if (!isFeatureEnabled(user, 'bills')) continue;
    const entitlements = await getFinanceEntitlements(user);
    if (!hasAnyFinanceAccess(entitlements)) continue;
    const today = localClock(now, timeZone).date;
    for (const result of await dueTomorrow(user, today, now, correlationId)) count(result);
    for (const result of await overdue(user, today, now, correlationId)) count(result);
    const paydayResult = await paydayNote(user, entitlements, today, now, correlationId);
    if (paydayResult) count(paydayResult);
  }
  return tally;
}

/** Paid by hand: no payment method set (older bills) counts as by hand, as the plan does. */
const byHand = or(isNull(subscriptions.paymentMethod), eq(subscriptions.paymentMethod, 'manual'));

async function dueTomorrow(user: User, today: string, now: Date, correlationId: CorrelationId | null): Promise<NotifyResult[]> {
  const tomorrow = addDays(today, 1);
  const bills = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.status, 'active'), byHand, eq(subscriptions.nextBillingDate, toUtcDate(tomorrow))));
  const results: NotifyResult[] = [];
  for (const bill of bills) {
    const [payment] = await db
      .select({ status: subscriptionPayments.status, expectedAmount: subscriptionPayments.expectedAmount })
      .from(subscriptionPayments)
      .where(and(eq(subscriptionPayments.subscriptionId, bill.id), eq(subscriptionPayments.expectedDate, toUtcDate(tomorrow))))
      .limit(1);
    if (payment && ['paid', 'skipped', 'cancelled'].includes(payment.status)) continue;
    results.push(await notify(user.id, (prefs) => billDue({ id: bill.id, name: bill.name, amount: payment?.expectedAmount ?? bill.amount, currency: bill.currency }, prefs), { refKey: `due:${bill.id}:${tomorrow}`, now, correlationId: correlationId ?? undefined }));
  }
  return results;
}

async function overdue(user: User, today: string, now: Date, correlationId: CorrelationId | null): Promise<NotifyResult[]> {
  // The bill's own due date if it gave one, else the cycle's date; in the last week only, so
  // turning push on doesn't bring up every old one.
  const due = sql<string>`coalesce(${subscriptionPayments.dueDate}, (${subscriptionPayments.expectedDate})::date)`;
  const rows = await db
    .select({ paymentId: subscriptionPayments.id, billId: subscriptions.id, name: subscriptions.name, dueDate: due, expectedDate: subscriptionPayments.expectedDate })
    .from(subscriptionPayments)
    .innerJoin(subscriptions, eq(subscriptions.id, subscriptionPayments.subscriptionId))
    .where(and(
      eq(subscriptions.userId, user.id),
      eq(subscriptions.status, 'active'),
      byHand,
      inArray(subscriptionPayments.status, ['pending', 'missed']),
      gte(due, addDays(today, -7)),
      lt(due, today),
    ));
  const results: NotifyResult[] = [];
  for (const row of rows) {
    const dueDate = typeof row.dueDate === 'string' ? row.dueDate.slice(0, 10) : fromUtcDate(row.expectedDate);
    results.push(await notify(user.id, () => billOverdue({ id: row.billId, name: row.name, dueDate }), { refKey: `overdue:${row.paymentId}`, now, correlationId: correlationId ?? undefined }));
  }
  return results;
}

async function paydayNote(user: User, entitlements: Awaited<ReturnType<typeof getFinanceEntitlements>>, today: string, now: Date, correlationId: CorrelationId | null): Promise<NotifyResult | null> {
  const [income] = await db
    .select()
    .from(incomeSources)
    .where(and(eq(incomeSources.userId, user.id), eq(incomeSources.isPrimary, true), eq(incomeSources.status, 'active')))
    .limit(1);
  if (!income || !paydaysBetween(income, today, addDays(today, 1)).includes(today)) return null;
  const plan = await loadPlan(user, entitlements, { type: 'mine' }, today, 0);
  if (!plan) return null;
  return notify(user.id, (prefs) => payday({ month: plan.period.label.split(' ')[0], remainingCents: plan.totals.remainingCents, weeklyCents: plan.totals.weeklyCents, currency: plan.currency }, prefs), { refKey: `payday:${today}`, now, correlationId: correlationId ?? undefined });
}
