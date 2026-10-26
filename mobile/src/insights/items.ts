import { type WireItemPurchase, type WireTopItem } from '@shared/api/insights';

/**
 * One item's spending (the website's hooks/use-item-analysis.ts): every variant of its name in the
 * top items ("Milk", "Milk 2L"), added up, its merchants, and the receipts it was on. Matched
 * exactly first; otherwise every word of the search has to appear in the name, or one name contain
 * the other.
 */

export type ItemAnalysis = {
  title: string;
  totals: { purchases: number; spent: number; quantity: number; averagePrice: number; currency: string };
  variants: Array<{ name: string; count: number; totalSpent: number; averagePrice: number; merchants: string[] }>;
  merchants: Array<{ merchant: string; count: number; total: number; average: number }>;
  purchases: WireItemPurchase[];
};

export function matchItems(search: string, items: WireTopItem[]): WireTopItem[] {
  const wanted = search.toLowerCase().trim();
  const exact = items.filter((item) => item.name.toLowerCase().trim() === wanted);
  if (exact.length > 0) return exact;
  const words = wanted.split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    const name = item.name.toLowerCase().trim();
    return words.every((word) => name.includes(word)) || name.includes(wanted) || wanted.includes(name);
  });
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Null when nothing matches. */
export function analyseItem(search: string, items: WireTopItem[], purchases: WireItemPurchase[], fallbackCurrency: string): ItemAnalysis | null {
  const matched = matchItems(search, items);
  if (matched.length === 0) return null;

  const spent = matched.reduce((total, item) => total + item.totalSpent, 0);
  const count = matched.reduce((total, item) => total + item.count, 0);
  const quantity = matched.reduce((total, item) => total + item.totalQuantity, 0);

  const byMerchant = new Map<string, { count: number; total: number }>();
  for (const item of matched) {
    for (const { merchant, count: times, total } of item.merchantBreakdown ?? []) {
      const entry = byMerchant.get(merchant) ?? { count: 0, total: 0 };
      entry.count += times;
      entry.total += total;
      byMerchant.set(merchant, entry);
    }
  }

  return {
    title: matched.length > 1 ? `${search.trim()} (${matched.length} kinds)` : matched[0].name,
    totals: { purchases: count, spent: round2(spent), quantity: round2(quantity), averagePrice: count ? round2(spent / count) : 0, currency: matched[0].currency || fallbackCurrency },
    variants: matched
      .map((item) => ({ name: item.name, count: item.count, totalSpent: item.totalSpent, averagePrice: item.averagePrice, merchants: item.merchants }))
      .sort((a, b) => b.count - a.count),
    merchants: Array.from(byMerchant, ([merchant, { count: times, total }]) => ({ merchant, count: times, total: round2(total), average: times ? round2(total / times) : 0 }))
      .sort((a, b) => b.count - a.count || b.total - a.total),
    purchases,
  };
}
