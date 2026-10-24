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
 * A larger hit area around a small control (a 16-20px tick box, a switch) without changing how it
 * looks: an invisible ::after that reaches 44px, the minimum comfortable tap target.
 */
export const TAP_TARGET = "relative after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']";
