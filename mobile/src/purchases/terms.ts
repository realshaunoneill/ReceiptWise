/**
 * The paywall's words about a subscription, as App Store guideline 3.1.2 asks: what it costs and
 * how often, the free trial and what follows it, that it renews by itself, and how to cancel.
 * Pure, from the store's product as RevenueCat describes it, so it's tested on its own.
 */

export type ProductLike = {
  priceString: string;
  /** ISO 8601: P1M, P1Y, P1W, P3M… */
  subscriptionPeriod: string | null;
  introPrice: { price: number; priceString: string; periodUnit: string; periodNumberOfUnits: number; cycles: number } | null;
};

const UNITS: Record<string, [string, string]> = {
  D: ['day', 'days'], DAY: ['day', 'days'],
  W: ['week', 'weeks'], WEEK: ['week', 'weeks'],
  M: ['month', 'months'], MONTH: ['month', 'months'],
  Y: ['year', 'years'], YEAR: ['year', 'years'],
};

const span = (count: number, unit: string) => {
  const [one, many] = UNITS[unit.toUpperCase()] ?? [unit.toLowerCase(), `${unit.toLowerCase()}s`];
  // 7 days reads as a week, as the stores show a 1-week trial.
  if ((unit === 'D' || unit === 'DAY') && count % 7 === 0) return count === 7 ? '1 week' : `${count / 7} weeks`;
  return `${count} ${count === 1 ? one : many}`;
};

/** "a month", "a year", "every 3 months": how often it's billed. */
export function billingPeriod(iso: string | null): string {
  const match = /^P(\d+)([DWMY])$/.exec(iso ?? '');
  if (!match) return '';
  const count = Number(match[1]);
  const unit = match[2];
  if (count === 1) return { D: 'a day', W: 'a week', M: 'a month', Y: 'a year' }[unit] ?? '';
  return `every ${span(count, unit)}`;
}

/** "€1.99 a month", or "Free for 1 week, then €1.99 a month" when the trial applies. */
export function priceLine(product: ProductLike, trial: boolean): string {
  const regular = `${product.priceString} ${billingPeriod(product.subscriptionPeriod)}`.trim();
  const intro = trial ? product.introPrice : null;
  if (!intro) return regular;
  const length = span(intro.periodNumberOfUnits * Math.max(1, intro.cycles), intro.periodUnit);
  return intro.price === 0 ? `Free for ${length}, then ${regular}` : `${intro.priceString} for ${length}, then ${regular}`;
}

/** The small print under the button. */
export function renewalTerms(store: 'ios' | 'android'): string {
  return store === 'ios'
    ? "Renews automatically until you cancel. Cancel at least 24 hours before the end of the period in your iPhone's Settings, under your name › Subscriptions. Payment is charged to your Apple Account."
    : 'Renews automatically until you cancel. Cancel any time in Google Play, under Payments & subscriptions › Subscriptions. Payment is charged to your Google Play account.';
}
