/**
 * Money arithmetic in integer cents.
 *
 * Amounts are stored as decimal strings: the older `text` amount columns, and the newer
 * `numeric(12,2)` columns that Drizzle returns as strings. Adding them as floats drifts
 * (0.1 + 0.2), so anything that sums or compares money converts to cents first and back at
 * the edge.
 */

const DECIMAL = /^(-)?(\d+)(?:\.(\d+))?$/;

/**
 * Parse a decimal amount to whole cents, rounding half away from zero at the third decimal.
 * Returns null for anything that isn't a plain decimal ("", "abc", "1e3", "1,50", NaN).
 */
export function toCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;

  let text: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    // toFixed avoids exponent notation; 10 places is far past anything a currency uses.
    text = value.toFixed(10);
  } else {
    text = value.trim();
  }

  const match = DECIMAL.exec(text);
  if (!match) return null;

  const [, minus, whole, fraction = ''] = match;
  const padded = (fraction + '000').slice(0, 3);
  let cents = Number(whole) * 100 + Number(padded.slice(0, 2));
  if (Number(padded[2]) >= 5) cents += 1;
  if (!Number.isSafeInteger(cents)) return null;
  return minus && cents !== 0 ? -cents : cents;
}

/** Whole cents back to a two-decimal string, the format the amount columns hold ("12.30", "-0.05"). */
export function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Sum of the amounts that parse; unparseable ones are skipped. */
export function sumCents(values: Array<number | null | undefined>): number {
  let total = 0;
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) total += value;
  }
  return total;
}

/** Cents as a number of currency units, for formatCurrency/Intl. */
export function centsToUnits(cents: number): number {
  return cents / 100;
}
