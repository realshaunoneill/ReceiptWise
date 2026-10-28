import { toCents, fromCents } from '../money';
import { type LocalDate } from '../dates/local-date';
import { type Period } from '../schedule/pay-schedule';
import { firstBillDate } from './new-bill';

/**
 * The guided plan setup, for the app's first run and the website's (and "Set up your plan" when
 * there's no pay yet): your pay, then your main bills picked from a list, then what's left after
 * them. It teaches by doing: a minute in, the plan is real. The picks are essential bills, with
 * the category and payment method they usually have, so they come off before "After bills".
 */
export type BillPick = {
  key: string;
  label: string;
  category: string;
  paymentMethod: 'direct_debit' | 'standing_order' | 'card' | 'manual';
  amountType: 'fixed' | 'variable';
  /** The usual day of the month, when there is one (rent on the 1st). */
  day?: number;
};

export const BILL_PICKS: readonly BillPick[] = [
  { key: 'home', label: 'Rent or mortgage', category: 'Housing', paymentMethod: 'standing_order', amountType: 'fixed', day: 1 },
  { key: 'electricity', label: 'Electricity', category: 'Utilities', paymentMethod: 'direct_debit', amountType: 'variable' },
  { key: 'gas', label: 'Gas', category: 'Utilities', paymentMethod: 'direct_debit', amountType: 'variable' },
  { key: 'phone', label: 'Phone', category: 'Phone & internet', paymentMethod: 'direct_debit', amountType: 'fixed' },
  { key: 'broadband', label: 'Broadband', category: 'Phone & internet', paymentMethod: 'direct_debit', amountType: 'fixed' },
  { key: 'car', label: 'Car loan or finance', category: 'Loans', paymentMethod: 'direct_debit', amountType: 'fixed' },
  { key: 'car-insurance', label: 'Car insurance', category: 'Insurance', paymentMethod: 'direct_debit', amountType: 'fixed' },
  { key: 'health', label: 'Health insurance', category: 'Insurance', paymentMethod: 'direct_debit', amountType: 'fixed' },
  { key: 'card', label: 'Credit card', category: 'Credit card', paymentMethod: 'manual', amountType: 'variable' },
  { key: 'childcare', label: 'Childcare', category: 'Childcare', paymentMethod: 'manual', amountType: 'fixed' },
];

/**
 * An amount as people type it: "3,820", "€1,450.00", "12,50" (a decimal comma). The same reading
 * as pasted lists (./parse-lines.ts). Cents, or null.
 */
export function typedCents(text: string): number | null {
  const plain = text.replace(/[€£$\s]/g, '');
  return toCents(/^-?\d+,\d{1,2}$/.test(plain) ? plain.replace(',', '.') : plain.replace(/,/g, ''));
}

export type PayAnswer = {
  amount: string;
  frequency: 'monthly' | 'last_working_day' | 'weekly' | 'fortnightly' | 'four_weekly';
  /** Monthly: the day of the month. */
  payDay?: number | null;
  /** Weekly, fortnightly, four-weekly: any day you were paid. */
  anchorDate?: LocalDate | null;
};

export type BillAnswer = { key: string; label: string; amount: string; day?: number | null };

/** What's wrong with the pay, in words, or null. */
export function payProblem(pay: PayAnswer): string | null {
  const cents = typedCents(pay.amount);
  if (cents === null || cents <= 0) return 'Enter what you get paid';
  if (pay.frequency === 'monthly' && !(Number.isInteger(pay.payDay) && pay.payDay! >= 1 && pay.payDay! <= 31)) return 'Pick a payday from 1 to 31';
  if (['weekly', 'fortnightly', 'four_weekly'].includes(pay.frequency) && !pay.anchorDate) return 'Pick a day you were paid';
  return null;
}

/** POST /api/income's body for the pay: the main pay, which sets the plan's periods. */
export function incomeRequest(pay: PayAnswer, currency: string, householdId: string | null = null) {
  const weekly = ['weekly', 'fortnightly', 'four_weekly'].includes(pay.frequency);
  return {
    name: 'Salary',
    amount: fromCents(typedCents(pay.amount) ?? 0),
    currency,
    frequency: pay.frequency,
    payDay: pay.frequency === 'monthly' ? pay.payDay ?? null : null,
    anchorDate: weekly ? pay.anchorDate ?? null : null,
    weekendRule: 'previous_business_day',
    isPrimary: true,
    householdId,
  };
}

/** The bills worth adding: a pick with an amount over zero. */
export function billsToAdd(bills: BillAnswer[]): BillAnswer[] {
  return bills.filter((bill) => {
    const cents = typedCents(bill.amount);
    return cents !== null && cents > 0;
  });
}

/**
 * POST /api/subscriptions's bodies for the bills: monthly, essential, paid the way that bill
 * usually is, on its day (else the day the plan starts), starting in the period on screen so they
 * show in this month's plan.
 */
export function billRequests(bills: BillAnswer[], period: Period, currency: string, householdId: string | null = null) {
  return billsToAdd(bills).map((bill) => {
    const pick = BILL_PICKS.find((candidate) => candidate.key === bill.key);
    const day = bill.day && bill.day >= 1 && bill.day <= 31 ? bill.day : pick?.day ?? Number(period.start.slice(8, 10));
    return {
      name: bill.label.trim() || pick?.label || 'Bill',
      amount: fromCents(typedCents(bill.amount) ?? 0),
      currency,
      billingFrequency: 'monthly',
      billingDay: day,
      startDate: firstBillDate(period, day),
      kind: 'bill',
      amountType: pick?.amountType ?? 'fixed',
      paymentMethod: pick?.paymentMethod ?? null,
      category: pick?.category ?? null,
      householdId,
    };
  });
}
