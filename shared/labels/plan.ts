// How the plan names things, for the website and the app.

/** How a bill is paid, as the plan shows it. Card, direct debit and standing order are assumed paid once due. */
export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  direct_debit: 'Direct debit',
  standing_order: 'Standing order',
  card: 'Card',
  manual: 'Pay manually',
};

export const PAYMENT_METHOD_OPTIONS = ['direct_debit', 'standing_order', 'card', 'manual'] as const;
export type PaymentMethodOption = typeof PAYMENT_METHOD_OPTIONS[number];

export const ACCOUNT_KIND_LABEL: Record<string, string> = {
  current: 'Current',
  savings: 'Savings',
  cash: 'Cash',
};

/**
 * The bill-or-subscription choice, asked the way it matters: is it essential? An essential one is a
 * bill and comes off first, before the plan's "After bills" (shared/plan/breakdown.ts); the rest are
 * subscriptions. Car finance marked as a subscription left "After bills" at the whole pay.
 */
export const ESSENTIAL_COPY = {
  label: 'Essential',
  on: "A bill: rent, loans, energy, insurance, a credit card. It comes off first, before what's left after bills.",
  off: 'A subscription: a nice-to-have like Netflix or the gym, counted after the bills.',
} as const;

/**
 * What a line added with only an amount is called. Megan's sheet has amounts with nothing beside
 * them (money that went on bits and pieces), so quick add and "Paste a list" don't insist on one.
 */
export const UNLABELLED_LINE = 'Extra';
