import { toCents } from '@/lib/money';

/**
 * Whether a receipt plausibly pays a bill or subscription, before it is linked. Linking marks
 * the payment paid at the receipt's amount, so linking the wrong one (AVOCA €30.05 to Netflix)
 * silently recorded Netflix as paid at €30.05. This only says what clearly doesn't fit; the
 * person can still link it.
 */

export type ReceiptLike = { merchantName: string | null; totalAmount: string | null; currency: string | null };
export type ExpectedPayment = { name: string; providerKey?: string | null; amount: string; currency: string };

export type ReceiptMismatch =
  | { kind: 'currency'; receiptCurrency: string; expectedCurrency: string }
  | { kind: 'amount'; receiptCents: number; expectedCents: number }
  | { kind: 'merchant'; merchant: string };

/** An amount more than this far from the expected one is a mismatch (and at least MIN_AMOUNT_GAP_CENTS apart). */
const AMOUNT_TOLERANCE = 0.2;
const MIN_AMOUNT_GAP_CENTS = 100;

const NOISE_WORDS = new Set(['the', 'ltd', 'limited', 'plc', 'dac', 'inc', 'llc', 'co', 'com', 'www', 'ie', 'uk', 'eu', 'ireland', 'payment', 'subscription', 'bill', 'and']);

/** "NETFLIX.COM" → ["netflix"]; "Electric Ireland Ltd" → ["electric"]. */
function nameWords(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !NOISE_WORDS.has(word));
}

function namesOverlap(merchant: string, expected: ExpectedPayment): boolean {
  const merchantWords = nameWords(merchant);
  const expectedWords = [...nameWords(expected.name), ...nameWords(expected.providerKey)];
  // Nothing to compare (a merchant like "SP 24"): don't call it a mismatch.
  if (merchantWords.length === 0 || expectedWords.length === 0) return true;
  return merchantWords.some((word) => expectedWords.some((other) => word.startsWith(other) || other.startsWith(word)));
}

export function receiptMismatches(receipt: ReceiptLike, expected: ExpectedPayment): ReceiptMismatch[] {
  const problems: ReceiptMismatch[] = [];
  const receiptCurrency = receipt.currency?.toUpperCase();
  const expectedCurrency = expected.currency.toUpperCase();

  if (receiptCurrency && receiptCurrency !== expectedCurrency) {
    problems.push({ kind: 'currency', receiptCurrency, expectedCurrency });
  } else {
    const receiptCents = toCents(receipt.totalAmount);
    const expectedCents = toCents(expected.amount);
    if (receiptCents !== null && expectedCents !== null && expectedCents > 0) {
      const gap = Math.abs(receiptCents - expectedCents);
      if (gap >= MIN_AMOUNT_GAP_CENTS && gap > expectedCents * AMOUNT_TOLERANCE) {
        problems.push({ kind: 'amount', receiptCents, expectedCents });
      }
    }
  }

  // The merchant only adds to an amount or currency that's already off. On its own it misfired on
  // card statement names: "APPLE.COM/BILL" for iCloud+ at exactly the right €2.99.
  if (problems.length > 0 && receipt.merchantName && !namesOverlap(receipt.merchantName, expected)) {
    problems.push({ kind: 'merchant', merchant: receipt.merchantName });
  }
  return problems;
}
