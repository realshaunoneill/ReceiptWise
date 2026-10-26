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
  isBusinessExpense: boolean | null;
};

/** One occurrence of a bill (a row of subscription_payments). Dates are ISO instants, dueDate a day. */
export type WirePayment = {
  id: string;
  subscriptionId: string;
  receiptId: string | null;
  expectedDate: string;
  expectedAmount: string;
  /** The bill's own due date when it differs from the schedule's, YYYY-MM-DD. */
  dueDate: string | null;
  /** 'estimate' | 'bill' | 'manual' | 'receipt' */
  amountSource: string;
  /** 'pending' | 'paid' | 'missed' | 'skipped' | 'cancelled' */
  status: string;
  actualDate: string | null;
  actualAmount: string | null;
  /** 'receipt' | 'manual' | 'assumed', or null on older rows */
  paidVia: string | null;
  notes: string | null;
};

/** A bill document filed against the bill; its file is at /api/bills/documents/[id]/file. */
export type WireFiledBill = {
  id: string;
  paymentId: string | null;
  fileName: string | null;
  provider: string | null;
  amountDue: string | null;
  currency: string | null;
  dueDate: string | null;
  issueDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
};

/** GET /api/subscriptions/[id]: the bill, its last 24 occurrences, newest first, and filed bills. */
export type WireBillDetail = WireBill & {
  payments: WirePayment[];
  bills: WireFiledBill[];
  /** False for a household member: they can mark payments, not edit it. */
  canEdit: boolean;
  paidFromAccountId: string | null;
};

/** A bill this document could be filed against, best first. */
export type WireMatchSuggestion = { id: string; name: string; score: number; reason: string };

/** One of GET /api/bills/documents: a bill brought in by upload, the app or email. */
export type WireBillDocument = {
  id: string;
  userId: string;
  householdId: string | null;
  /** 'upload' | 'app' | 'email' | 'receipt_move' */
  source: string;
  mimeType: string;
  fileName: string | null;
  /** 'pending' | 'processing' | 'completed' | 'failed' */
  processingStatus: string;
  processingError: string | null;
  documentType: string | null;
  provider: string | null;
  amountDue: string | null;
  currency: string | null;
  dueDate: string | null;
  issueDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  minimumPayment: string | null;
  isDirectDebit: boolean | null;
  duplicateOfId: string | null;
  /** 'pending_review' | 'needs_document' | 'not_a_bill' | 'applied' | 'dismissed' */
  reviewStatus: string;
  autoApplied: boolean;
  subscriptionId: string | null;
  createdAt: string;
};

/** The review list (?review=true) adds where each could be filed. */
export type WireInboxDocument = WireBillDocument & { suggestions: WireMatchSuggestion[] };
