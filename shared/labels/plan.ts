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
