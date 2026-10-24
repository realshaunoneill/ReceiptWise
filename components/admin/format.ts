import { formatLocalDate, isLocalDate } from '@/lib/dates/local-date';
import { centsToUnits, toCents } from '@/lib/money';
import { DEFAULT_CURRENCY, formatCurrency } from '@/lib/utils/currency';

/**
 * Formatting shared by the admin cards, so a receipt's amount reads the same everywhere ("€12.30",
 * not "EUR 12.3" in one card and "€ 12.30" in another).
 */

export function formatReceiptAmount(amount: string | null | undefined, currency: string | null | undefined): string {
  return formatCurrency(centsToUnits(toCents(amount) ?? 0), currency || DEFAULT_CURRENCY);
}

const DAY_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** An instant (createdAt and the like) as its day in the viewer's time zone. */
export function formatInstantDay(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-IE', DAY_FORMAT);
}

/**
 * A receipt's own day. transactionDate is a calendar day (or an ISO string starting with one);
 * going through new Date() and toLocaleDateString showed it a day early west of UTC. Falls back
 * to the upload day without one.
 */
export function formatReceiptDay(transactionDate: string | null | undefined, createdAt: string | Date): string {
  const day = transactionDate?.slice(0, 10);
  if (day && isLocalDate(day)) return formatLocalDate(day, DAY_FORMAT, 'en-IE');
  return formatInstantDay(createdAt);
}
