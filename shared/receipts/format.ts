import { daysBetween, formatLocalDate, isLocalDate, localToday, type LocalDate } from '../dates/local-date';
import { CATEGORY_INFO, getCategoryInfo } from './categories';

/*
 * Display helpers shared by the receipts and insights views.
 *
 * Dates used to come out three ways: the raw "2026-10-21", `toLocaleDateString('en-US')`'s
 * "Oct 21, 2026", and the browser default ("10/21/2026"). `new Date('2026-10-21')` is also
 * midnight UTC, so anyone west of UTC saw the day before. One en-IE format now, with calendar
 * days formatted as calendar days.
 */

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** "21 Oct 2026". A `YYYY-MM-DD` string is a calendar day; anything else is an instant shown in local time. */
export function formatDisplayDate(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = DATE_FORMAT,
): string {
  if (!value) return '';
  if (typeof value === 'string' && isLocalDate(value)) return formatLocalDate(value, options, 'en-IE');
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : '';
  return new Intl.DateTimeFormat('en-IE', options).format(date);
}

/**
 * A day's heading in a list of receipts: "Today", "Yesterday", then "Wed 7 Jan", with the year
 * only when it isn't this one ("Wed 31 Dec 2025"). Built from parts because en-IE's short date
 * comes out as "Wed, 7 Jan" in some engines and without the comma in others. The website's
 * timeline and the app's list both use it.
 */
export function dayHeading(day: LocalDate, today: LocalDate): string {
  const ago = daysBetween(day, today);
  if (ago === 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  const weekday = formatLocalDate(day, { weekday: 'short' }, 'en-IE');
  const date = formatLocalDate(day, day.slice(0, 4) === today.slice(0, 4) ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }, 'en-IE');
  return `${weekday} ${date}`;
}

/** The calendar day a receipt is for: its transaction date, or the local day it was uploaded. */
export function receiptDay(receipt: { transactionDate?: string | null; createdAt?: string | Date | null }): string | null {
  if (receipt.transactionDate && isLocalDate(receipt.transactionDate)) return receipt.transactionDate;
  if (!receipt.createdAt) return null;
  const created = new Date(receipt.createdAt);
  return Number.isNaN(created.getTime()) ? null : localToday(created);
}

const PAYMENT_BRANDS = ['Apple Pay', 'Google Pay', 'Samsung Pay', 'PayPal', 'Revolut', 'Visa', 'Mastercard', 'Maestro', 'Amex', 'American Express', 'PIN', 'Klarna', 'Curve'];

/** The everyday words in a payment method, which stay lower case after the first word ("Debit card"). */
const PAYMENT_WORDS = new Set(['card', 'credit', 'debit', 'contactless', 'cash', 'chip', 'payment', 'online', 'transfer', 'voucher', 'gift']);

/**
 * "Apple Pay", "Chip & PIN", "Credit card", "Visa ····4821". Was `capitalizeText`, which
 * lower-cases everything after the first letter of each underscore-separated word, so the scanner's
 * "Apple Pay" came out as "Apple pay". The scanner also writes "CreditCard", "Credit Card" and
 * "Card ending in 1784"; those read as the rest of the app's sentence case, and a card's last four
 * as ····1784.
 */
export function formatPaymentMethod(raw: string): string {
  const spaced = raw
    .replace(/_+/g, ' ')
    .replace(/master\s*card/gi, 'Mastercard')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s*(?:ending(?:\s+in)?|\*{2,}|x{2,}|[·•]{2,})\s*(\d{4})\b/gi, ' ····$1')
    .replace(/\s+/g, ' ')
    .trim();
  // Only all-lower or all-upper is recased as a whole; mixed case from the receipt keeps its words.
  let label = spaced === spaced.toLowerCase() || spaced === spaced.toUpperCase()
    ? spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
    : spaced;
  label = label.split(' ').map((word, index) => (index > 0 && PAYMENT_WORDS.has(word.toLowerCase()) ? word.toLowerCase() : word)).join(' ');
  for (const brand of PAYMENT_BRANDS) {
    // Tolerates the space a split "MasterCard" or "PayPal" picked up.
    const pattern = brand.split(/(?=[A-Z])|\s+/).filter(Boolean).join('\\s*');
    label = label.replace(new RegExp(`\\b${pattern}\\b`, 'gi'), brand);
  }
  return label;
}

/**
 * A spending category's name. Receipt categories are the scanner's fixed vocabulary, so they go
 * through the shared table ("gas" is "Fuel"); item categories are free text ("dairy"), which the
 * table would file under "Other", so those keep their own word.
 */
export function categoryName(category: string | null | undefined): string {
  if (!category) return getCategoryInfo(category).label;
  const key = category.trim().toLowerCase();
  if (key in CATEGORY_INFO) return getCategoryInfo(key).label;
  const words = category.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

/** "tesco-2026-10-21.jpg". Was `receipt-<ISO timestamp of the download>.jpg`, whatever the file was. */
export function receiptFileName(merchant: string | null | undefined, day: string | null | undefined, mimeType?: string): string {
  const slug = (merchant ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '') || 'receipt';
  const extension = (mimeType && EXTENSIONS[mimeType.split(';')[0].trim()]) || 'jpg';
  return `${[slug, day].filter(Boolean).join('-')}.${extension}`;
}
