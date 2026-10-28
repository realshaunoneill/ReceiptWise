import { formatTotals, totalsByCurrency } from '@shared/currency-totals';
import { type LocalDate } from '@shared/dates/local-date';
import { type WireReceipt } from '@shared/api/receipts';
import { dayHeading, receiptDay } from '@shared/receipts/format';

// The day headings are shared with the website's timeline (shared/receipts/format.ts).
export { dayHeading };

export type ReceiptRow =
  | { type: 'day'; key: string; label: string; total: string; count: number }
  | { type: 'receipt'; key: string; receipt: WireReceipt };

/**
 * Receipts under a heading per day, with the day's total (each currency on its own, never
 * converted) and count, as on the website's timeline. Receipts with no day yet (still being read)
 * come first, under "Being read".
 */
export function groupByDay(receipts: WireReceipt[], today: LocalDate, currency: string): ReceiptRow[] {
  const groups = new Map<string, WireReceipt[]>();
  for (const receipt of receipts) {
    const day = receiptDay(receipt) ?? '';
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(receipt);
  }
  const days = [...groups.keys()].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : b.localeCompare(a)));
  return days.flatMap((day) => {
    const items = groups.get(day)!;
    const counted = items.filter((r) => r.processingStatus === 'completed' && r.isReceipt !== false);
    const heading: ReceiptRow = {
      type: 'day',
      key: `day-${day || 'reading'}`,
      label: day ? dayHeading(day, today) : 'Being read',
      total: formatTotals(totalsByCurrency(counted.map((r) => ({ amount: r.totalAmount, currency: r.currency })), currency), currency),
      count: items.length,
    };
    return [heading, ...items.map((receipt): ReceiptRow => ({ type: 'receipt', key: receipt.id, receipt }))];
  });
}
