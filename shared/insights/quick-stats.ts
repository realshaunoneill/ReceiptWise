import { formatLocalDate, isLocalDate, type LocalDate } from '../dates/local-date';
import { categoryName } from '../receipts/format';

/**
 * The figures at the top of the dashboard and the app's Home, named for what they are, and the
 * line a spending card shows for a period with nothing in it. Shared so both say the same.
 */

export type QuickStatTile = { key: 'receipts' | 'average' | 'category'; label: string; value: string; detail: string };

/**
 * Three tiles: how many receipts (and how many this month), the average receipt, and where most
 * went. "Line items · Read off those receipts" and "Total divided by receipts" explained the
 * arithmetic rather than saying anything; a spend-this-month tile would repeat the card below.
 */
export function quickStatTiles(
  stats: { totalReceipts: number; avgSpending: number; spendingByCategory: Array<{ category: string }>; currency?: string; otherCurrencies?: Array<{ currency: string; receipts: number }> },
  receiptsThisMonth: number | null,
  formatMoney: (amount: number) => string,
): QuickStatTile[] {
  const top = stats.spendingByCategory[0]?.category;
  return [
    {
      key: 'receipts',
      label: 'Receipts',
      value: stats.totalReceipts.toLocaleString('en-IE'),
      detail: receiptsThisMonth === null ? 'All time' : receiptsThisMonth === 0 ? 'None this month' : `${receiptsThisMonth.toLocaleString('en-IE')} this month`,
    },
    // Amounts are never converted: with receipts in other currencies, the average is of yours.
    { key: 'average', label: 'Average receipt', value: formatMoney(stats.avgSpending), detail: stats.otherCurrencies?.length && stats.currency ? `${stats.currency} receipts only` : 'Per receipt' },
    { key: 'category', label: 'Top category', value: top ? categoryName(top) : 'None yet', detail: 'Most spent' },
  ];
}

/** The first day of today's calendar month: what ?from= asks for to count this month's receipts. */
export function monthStart(today: LocalDate): LocalDate {
  return `${today.slice(0, 8)}01`;
}

/**
 * The newest receipt date among these (the latest few added), or null. A receipt with no date
 * read off it counts on the day it was added.
 */
export function latestReceiptDay(receipts: Array<{ transactionDate?: string | null; createdAt?: string | Date | null }>): LocalDate | null {
  let latest: LocalDate | null = null;
  for (const receipt of receipts) {
    const created = receipt.createdAt ? new Date(receipt.createdAt).toISOString().slice(0, 10) : null;
    const day = receipt.transactionDate && isLocalDate(receipt.transactionDate.slice(0, 10)) ? receipt.transactionDate.slice(0, 10) : created;
    if (day && (!latest || day > latest)) latest = day;
  }
  return latest;
}

export type SpendingPeriod = 'week' | 'month' | 'year';

/**
 * A period with no spending: "Nothing this month yet. Your last receipt was 7 Jan." It used to say
 * "No spending yet. Upload receipts…" to someone with a dozen receipts, none of them this month.
 */
export function nothingSpentLine(period: SpendingPeriod, lastReceipt: LocalDate | null, today: LocalDate): string {
  const nothing = period === 'week' ? 'Nothing in the last 7 days.' : period === 'month' ? 'Nothing this month yet.' : 'Nothing this year yet.';
  if (!lastReceipt) return nothing;
  const sameYear = lastReceipt.slice(0, 4) === today.slice(0, 4);
  const day = formatLocalDate(lastReceipt, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }, 'en-IE');
  return `${nothing} Your last receipt was ${day}.`;
}
