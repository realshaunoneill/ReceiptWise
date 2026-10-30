/**
 * The weekly growth report's numbers and its text (posted to Discord by /api/cron/growth-report).
 * Pure, so the wording is tested; lib/growth/gather.ts fills it from the database and Stripe.
 * Everything here comes from data the service already holds to run (accounts, subscriptions,
 * households), never from analytics, which need consent.
 */

export type GrowthData = {
  /** The week reported: [from, to). */
  from: Date;
  to: Date;
  accounts: { total: number; thisWeek: number; lastWeek: number; bySource: Array<{ source: string; count: number }> };
  /** Accounts made in the last 14 days, and how many of them did something with ReceiptWise. */
  activation: { accounts: number; plan: number; receiptOrBill: number };
  trials: { started: number; converted: number; cancelled: number };
  /** Paying now (Stripe and the stores), comp Premium, and monthly recurring revenue in cents (EUR). */
  premium: { stripe: number; store: number; comp: number; mrrCents: number };
  households: { total: number; covered: number };
};

export const DAY = 24 * 60 * 60 * 1000;

/** The Monday 00:00 UTC that ends the week reported: the latest one at or before `now`. */
export function reportWeekEnd(now: Date): Date {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const sinceMonday = (end.getUTCDay() + 6) % 7;
  return new Date(end.getTime() - sinceMonday * DAY);
}

const day = (date: Date) => new Intl.DateTimeFormat('en-IE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Dublin' }).format(date);
const euro = (cents: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function formatGrowthReport(data: GrowthData): string {
  const { accounts, activation, trials, premium, households } = data;
  const sources = accounts.bySource.length
    ? accounts.bySource.map(({ source, count }) => `${source} ${count}`).join(' · ')
    : 'none';
  const lines = [
    `**ReceiptWise, the week to ${day(new Date(data.to.getTime() - 1))}**`,
    `New accounts: **${accounts.thisWeek}** (the week before: ${accounts.lastWeek}) · ${accounts.total} in all`,
    `Where they came from: ${sources}`,
    `Trials: ${trials.started} started · ${trials.converted} became paid · ${trials.cancelled} cancelled`,
    `Paying: **${premium.stripe + premium.store}** (website ${premium.stripe}, app stores ${premium.store}) · MRR **${euro(premium.mrrCents)}** · given Premium ${premium.comp}`,
    `Households: ${households.total} · ${plural(households.covered, 'person', 'people')} covered by someone else's Premium`,
    activation.accounts > 0
      ? `Of the ${plural(activation.accounts, 'account')} made in the last 14 days: ${activation.plan} set up a plan, ${activation.receiptOrBill} added a receipt or bill`
      : 'No accounts made in the last 14 days',
  ];
  return lines.join('\n');
}
