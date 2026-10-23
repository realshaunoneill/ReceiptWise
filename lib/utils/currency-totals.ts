import { centsToUnits, sumCents, toCents } from '@/lib/money';
import { formatCurrency } from '@/lib/utils/currency';

export type CurrencyTotal = { currency: string; amount: number };

/**
 * Totals per currency, the preferred currency first. Subscriptions and receipts can be in any
 * supported currency, and the totals used to add them all up as if they were the user's, so
 * €10 + $10 showed as €20. There is no conversion: each currency is totalled on its own.
 */
export function totalsByCurrency(
  items: Array<{ amount: number | string | null | undefined; currency: string | null | undefined }>,
  preferredCurrency: string,
): CurrencyTotal[] {
  const cents = new Map<string, number[]>();
  for (const item of items) {
    const value = toCents(item.amount ?? null);
    if (value === null) continue;
    const currency = item.currency || preferredCurrency;
    if (!cents.has(currency)) cents.set(currency, []);
    cents.get(currency)!.push(value);
  }

  const totals = [...cents.entries()].map(([currency, values]) => ({ currency, amount: centsToUnits(sumCents(values)) }));
  return totals.sort((a, b) => {
    if (a.currency === preferredCurrency) return -1;
    if (b.currency === preferredCurrency) return 1;
    return a.currency.localeCompare(b.currency);
  });
}

/** "€42.00", or "€42.00 + $10.00" when there is more than one currency; "€0.00" when empty. */
export function formatTotals(totals: CurrencyTotal[], preferredCurrency: string): string {
  if (totals.length === 0) return formatCurrency(0, preferredCurrency);
  return totals.map((total) => formatCurrency(total.amount, total.currency)).join(' + ');
}
