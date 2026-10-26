import { type WireBill, type WirePayment } from '@shared/api/bills';
import { totalsByCurrency, type CurrencyTotal } from '@shared/currency-totals';
import { daysBetween, formatLocalDate, fromUtcDate } from '@shared/dates/local-date';
import { monthlyEquivalent } from '@shared/schedule/billing-schedule';

/**
 * The Bills tab's arithmetic and wording, as on the website's subscriptions page: monthly and
 * yearly totals per currency, the kind and "not marked paid" filters, and when each is next due.
 */

export type ListedBill = WireBill & { missingPayments?: number; recentPayments?: WirePayment[] };
export type KindFilter = 'all' | 'bill' | 'subscription';

/** A midnight-UTC instant (nextBillingDate, startDate) as its calendar day. */
export const billDay = (instant: string) => fromUtcDate(new Date(instant));

/** The day an occurrence is due: the bill's own due date if it gave one, else the schedule's. */
export const paymentDay = (payment: Pick<WirePayment, 'dueDate' | 'expectedDate'>) => payment.dueDate ?? billDay(payment.expectedDate);

/** Per currency (€10 and $10 are not €20), with the user's currency first. */
export function monthlyTotals(bills: ListedBill[], preferredCurrency: string): CurrencyTotal[] {
  return totalsByCurrency(
    bills.map((bill) => ({ amount: monthlyEquivalent(Number(bill.amount), bill.billingFrequency, bill.customFrequencyDays), currency: bill.currency })),
    preferredCurrency,
  );
}

/**
 * What the list shows: one kind or both, and with `missingOnly` just those with payments past due
 * that nobody marked paid (the server never counts direct debits, standing orders or cards).
 */
export function filterBills(bills: ListedBill[], kind: KindFilter, missingOnly: boolean): ListedBill[] {
  return bills.filter((bill) =>
    (kind === 'all' || (kind === 'bill' ? bill.kind === 'bill' : bill.kind !== 'bill'))
    && (!missingOnly || (bill.missingPayments ?? 0) > 0));
}

export const notMarkedPaid = (bills: ListedBill[]) => bills.reduce((total, bill) => total + (bill.missingPayments ?? 0), 0);

/** "Due today", "Due tomorrow", "Due in 3 days" within a week, then "Due 12 Nov" (DESIGN.md). */
export function dueLabel(day: string, today: string): string {
  const days = daysBetween(today, day);
  const date = formatLocalDate(day, { day: 'numeric', month: 'short' }, 'en-IE');
  if (days < 0) return `Was due ${date}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days < 7) return `Due in ${days} days`;
  return `Due ${date}`;
}
