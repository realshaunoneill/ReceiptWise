// The query keys both the website and the app use, so a change refreshes the same things in each.

/** What a receipt feeds: lists and totals (all under 'receipts'), one receipt, insights, the plan. */
export const RECEIPT_QUERY_KEYS = ['receipts', 'receipt', 'topItems', 'spendingSummary', 'itemAnalysis', 'plan'] as const;

/** What the plan is computed from: the plan, bills, one bill, income, goals and accounts. */
export const FINANCE_QUERY_KEYS = ['plan', 'subscriptions', 'subscription', 'income', 'goals', 'accounts'] as const;
