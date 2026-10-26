/**
 * One of GET /api/subscriptions: a bill or a subscription (the table is `subscriptions`; the
 * website and the app call them Bills). Amounts are strings; dates are ISO instants.
 */
export type WireBill = {
  id: string;
  userId: string;
  householdId: string | null;
  name: string;
  description: string | null;
  category: string | null;
  amount: string;
  currency: string;
  /** 'monthly' | 'bimonthly' | 'quarterly' | 'six_monthly' | 'yearly' | 'custom' | 'once' */
  billingFrequency: string;
  billingDay: number;
  customFrequencyDays: number | null;
  /** 'active' | 'paused' | 'cancelled' */
  status: string;
  /** 'subscription' | 'bill' */
  kind: string;
  /** 'fixed' | 'variable' */
  amountType: string;
  /** 'direct_debit' | 'standing_order' | 'card' | 'manual', or null */
  paymentMethod: string | null;
  startDate: string;
  endDate: string | null;
  nextBillingDate: string;
  lastPaymentDate: string | null;
  website: string | null;
  notes: string | null;
};
