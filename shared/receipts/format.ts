import { formatLocalDate, isLocalDate, localToday } from '../dates/local-date';
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

/** The calendar day a receipt is for: its transaction date, or the local day it was uploaded. */
export function receiptDay(receipt: { transactionDate?: string | null; createdAt?: string | Date | null }): string | null {
  if (receipt.transactionDate && isLocalDate(receipt.transactionDate)) return receipt.transactionDate;
  if (!receipt.createdAt) return null;
  const created = new Date(receipt.createdAt);
  return Number.isNaN(created.getTime()) ? null : localToday(created);
}

const PAYMENT_BRANDS = ['Apple Pay', 'Google Pay', 'Samsung Pay', 'PayPal', 'Revolut', 'Visa', 'Mastercard', 'Maestro', 'Amex', 'American Express', 'PIN'];

/**
 * "Apple Pay", "Chip & PIN", "Contactless". Was `capitalizeText`, which lower-cases everything
 * after the first letter of each underscore-separated word, so the scanner's "Apple Pay" came
 * out as "Apple pay".
 */
export function formatPaymentMethod(raw: string): string {
  const spaced = raw.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  // Leave mixed case from the receipt alone ("Visa Debit"); only all-lower or all-upper is recased.
  let label = spaced === spaced.toLowerCase() || spaced === spaced.toUpperCase()
    ? spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
    : spaced;
  for (const brand of PAYMENT_BRANDS) {
    label = label.replace(new RegExp(`\\b${brand}\\b`, 'gi'), brand);
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
