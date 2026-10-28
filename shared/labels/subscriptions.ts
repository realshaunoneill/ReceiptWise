/**
 * Words for the stored values of bills and subscriptions, so no screen shows "bimonthly",
 * "active" or "pending" as they are kept in the database.
 */

import { daysBetween, formatLocalDate, type LocalDate } from '../dates/local-date';
import { isAutoPaid } from '../schedule/billing-schedule';
import { getUrgency, type Urgency } from '../urgency';

/**
 * One category list for bills and subscriptions. The add and edit dialogs had different lists,
 * and neither had the bill categories (Housing, Transport, Credit card), so editing such a bill
 * showed a blank Category. A value that isn't in the list is kept and offered too (see
 * categoryOptions), never blanked.
 */
export const CATEGORY_GROUPS: ReadonlyArray<{ label: string; categories: readonly string[] }> = [
  {
    label: 'Bills',
    categories: ['Housing', 'Utilities', 'Phone & internet', 'Insurance', 'Transport', 'Credit card', 'Loans', 'Childcare', 'Healthcare', 'Education'],
  },
  {
    label: 'Subscriptions',
    categories: ['Streaming', 'Entertainment', 'Music', 'Software', 'Cloud storage', 'Gaming', 'News & magazines', 'Fitness', 'Food & meal kits'],
  },
  { label: 'Anything else', categories: ['Other'] },
];

const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap((group) => group.categories);

/** The groups to offer, with the current value first when it isn't one of them (older rows used other names). */
export function categoryOptions(current: string | null | undefined): ReadonlyArray<{ label: string; categories: readonly string[] }> {
  const value = current?.trim();
  if (!value || ALL_CATEGORIES.includes(value)) return CATEGORY_GROUPS;
  return [{ label: 'Current', categories: [value] }, ...CATEGORY_GROUPS];
}

const FREQUENCY_NAME: Record<string, string> = {
  monthly: 'Monthly',
  bimonthly: 'Every 2 months',
  quarterly: 'Every 3 months',
  six_monthly: 'Every 6 months',
  yearly: 'Yearly',
  once: 'Once',
};

/** "Monthly", "Every 2 months", "Every 14 days": how often, as a value on its own. */
export function frequencyName(billingFrequency: string, customFrequencyDays?: number | null): string {
  if (billingFrequency === 'custom') return `Every ${customFrequencyDays || 30} days`;
  return FREQUENCY_NAME[billingFrequency] ?? billingFrequency;
}

const STATUS_LABEL: Record<string, string> = { active: 'Active', paused: 'Paused', cancelled: 'Cancelled' };

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Due',
  paid: 'Paid',
  // The plan's word. For one paid by hand it's past its date and not ticked; for a direct debit,
  // marked as not gone out. Either way it's still owed.
  missed: 'Overdue',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
};

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABEL[status] ?? status;
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  direct_debit: 'Direct debit',
  standing_order: 'Standing order',
  card: 'Card',
  manual: 'Paid by hand',
};

export function paymentMethodLabel(paymentMethod: string | null | undefined): string {
  return (paymentMethod && PAYMENT_METHOD_LABEL[paymentMethod]) || 'Not said';
}

/** "bill" or "subscription", for wording about one item; always "subscription" without the bills feature. */
export function itemNoun(kind: string | null | undefined, billsEnabled: boolean): 'bill' | 'subscription' {
  return billsEnabled && kind === 'bill' ? 'bill' : 'subscription';
}

/**
 * What the next payment is: that cycle's own amount when one is set (read off a filed bill, or
 * typed in for that month), else the usual one. A variable bill on its usual amount is an
 * estimate. Megan's card is usually €0 with €809 set for November, so the list showed ~€0.
 */
export function nextPaymentAmount(bill: { amount: string; amountType?: string | null; nextAmount?: string | null }): { amount: number; estimated: boolean } {
  const own = bill.nextAmount != null ? Number(bill.nextAmount) : NaN;
  if (!Number.isNaN(own)) return { amount: own, estimated: false };
  const usual = Number(bill.amount);
  return { amount: Number.isNaN(usual) ? 0 : usual, estimated: bill.amountType === 'variable' };
}

/**
 * When the next payment is, worded by how it's paid. A direct debit, standing order or card
 * payment goes out by itself, so it "goes out" on its day and is never urgent; one paid by hand
 * is "due", and turns amber, then red, as the day comes. Days are YYYY-MM-DD.
 */
export function nextPaymentLabel(day: LocalDate, today: LocalDate, paymentMethod: string | null | undefined): { label: string; urgency: Urgency } {
  const days = daysBetween(today, day);
  const date = formatLocalDate(day, { day: 'numeric', month: 'short' }, 'en-IE');
  if (isAutoPaid(paymentMethod)) {
    const label = days < 0 ? `Went out ${date}`
      : days === 0 ? 'Goes out today'
        : days === 1 ? 'Goes out tomorrow'
          : days < 7 ? `Goes out in ${days} days`
            : `Goes out ${date}`;
    return { label, urgency: 'later' };
  }
  const label = days < 0 ? `Was due ${date}`
    : days === 0 ? 'Due today'
      : days === 1 ? 'Due tomorrow'
        : days < 7 ? `Due in ${days} days`
          : `Due ${date}`;
  return { label, urgency: getUrgency(days) };
}
