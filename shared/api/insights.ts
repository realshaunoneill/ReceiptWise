/**
 * What the insights routes return. These routes build plain objects with no server type to check
 * against (lib/types/wire-contract.ts can't cover them), so the types are written from the routes:
 * keep them in step when a route changes. Amounts here are numbers; the stats are in the viewer's
 * own currency only (receipts in others are counted, not summed).
 */

/** GET /api/receipts/stats: completed receipts in the view, all time; `points` from ?from=. */
export type WireReceiptStats = {
  totalReceipts: number;
  totalItems: number;
  totalSpent: number;
  /** Per receipt, not per day. */
  avgSpending: number;
  spendingByCategory: Array<{ category: string; amount: number; percentage: number }>;
  /** One per receipt since `from` (YYYY-MM-DD), for the trends; own-currency receipts only. */
  points?: Array<{ date: string; amount: number; category: string | null }>;
  /** The currency the amounts are in (the viewer's). Optional: older servers didn't send it. */
  currency?: string;
  /** Receipts in other currencies: in totalReceipts, not in any amount. */
  otherCurrencies?: Array<{ currency: string; receipts: number }>;
};

export type WirePeriod = { startDate: string; endDate: string; months: number };

/** One of GET /api/receipts/items/top: an item grouped by name, case-insensitively. */
export type WireTopItem = {
  name: string;
  count: number;
  totalSpent: number;
  totalQuantity: number;
  averagePrice: number;
  category: string | null;
  merchantCount: number;
  merchants: string[];
  merchantBreakdown?: Array<{ merchant: string; count: number; total: number }>;
  lastPurchased: string;
  currency: string;
};

export type WireTopItems = {
  topItems: WireTopItem[];
  summary: {
    totalUniqueItems: number;
    totalPurchases: number;
    /** The biggest currency's total only (older builds show this); `totals` has every currency. */
    totalSpent: number;
    currency: string;
    /** What was spent per currency, never added across currencies. Missing from older servers. */
    totals?: Array<{ currency: string; amount: number }>;
    period: WirePeriod;
  };
  sortBy: string;
};

/** One receipt in GET /api/receipts/items/history: the item's lines on it, added up. */
export type WireItemPurchase = {
  receiptId: string;
  merchant: string;
  date: string;
  imageUrl?: string | null;
  currency: string;
  quantity: string;
  price: string;
  itemCount: number;
  items: Array<{ name: string; quantity: string; price: string }>;
};

export type WireItemHistory = { itemName: string; purchases: WireItemPurchase[]; period: WirePeriod };

/**
 * GET /api/receipts/items/summary: the written summary (one AI call per period, kept 24 hours on
 * the server). A period with no receipts answers with the text alone.
 */
export type WireSpendingSummary = {
  summary: string;
  data?: {
    period: WirePeriod;
    /** Money in one currency only; `otherCurrencies` were bought in too but not counted in it. */
    statistics: { totalItems: number; totalSpent: number; currency: string; averagePerItem: number; otherCurrencies?: string[] };
    topItems: Array<{ name: string; count: number }>;
    topCategories: Array<{ category: string; total: number }>;
    topMerchants: Array<{ merchant: string; total: number }>;
  };
};
