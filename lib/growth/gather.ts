import Stripe from 'stripe';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { ENTITLED_STATUSES } from '@/lib/entitlements';
import { DAY, type GrowthData } from './report';

const count = async (query: ReturnType<typeof sql>): Promise<number> => {
  const [row] = await db.execute<{ n: number | string }>(query);
  return Number(row?.n ?? 0);
};

/**
 * The week before `to` (a Monday 00:00 UTC), from the database and Stripe (the website's
 * subscriptions; the app stores' come from premium_grants).
 */
export async function gatherGrowthData(to: Date, stripeKey = process.env.STRIPE_SECRET_KEY): Promise<GrowthData> {
  const from = new Date(to.getTime() - 7 * DAY);
  // Raw SQL parameters go to postgres-js as they are, and it won't take a Date: ISO strings.
  const [toAt, fromAt, beforeAt, recentAt] = [to, from, new Date(from.getTime() - 7 * DAY), new Date(to.getTime() - 14 * DAY)].map((d) => d.toISOString());
  const entitled = sql.join(ENTITLED_STATUSES.map((status) => sql`${status}`), sql`, `);
  const live = (sources: string[]) => sql`
    select count(distinct user_id) as n from premium_grants
    where source in (${sql.join(sources.map((s) => sql`${s}`), sql`, `)}) and status in (${entitled})
      and (expires_at is null or expires_at > now())`;

  const [total, thisWeek, lastWeek, bySource, activationAccounts, plan, receiptOrBill, households, covered, store, comp] = await Promise.all([
    count(sql`select count(*) as n from users`),
    count(sql`select count(*) as n from users where created_at >= ${fromAt} and created_at < ${toAt}`),
    count(sql`select count(*) as n from users where created_at >= ${beforeAt} and created_at < ${fromAt}`),
    db.execute<{ source: string; n: number | string }>(sql`
      select coalesce(signup_source, 'not recorded') as source, count(*) as n from users
      where created_at >= ${fromAt} and created_at < ${toAt} group by 1 order by 2 desc, 1`),
    count(sql`select count(*) as n from users where created_at >= ${recentAt} and created_at < ${toAt}`),
    count(sql`select count(*) as n from users u where u.created_at >= ${recentAt} and u.created_at < ${toAt}
      and exists (select 1 from income_sources i where i.user_id = u.id)`),
    count(sql`select count(*) as n from users u where u.created_at >= ${recentAt} and u.created_at < ${toAt}
      and (exists (select 1 from receipts r where r.user_id = u.id and r.deleted_at is null)
        or exists (select 1 from bill_documents b where b.user_id = u.id))`),
    count(sql`select count(*) as n from households`),
    count(live(['household'])),
    count(live(['app_store', 'play_store'])),
    count(live(['comp'])),
  ]);

  const trials = { started: 0, converted: 0, cancelled: 0 };
  let stripePaying = 0;
  let mrrCents = 0;
  if (stripeKey) {
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-12-15.clover' });
    const inWeek = (seconds: number | null | undefined) => seconds != null && seconds * 1000 >= from.getTime() && seconds * 1000 < to.getTime();
    for await (const subscription of stripe.subscriptions.list({ status: 'all', limit: 100 })) {
      if (inWeek(subscription.trial_start)) trials.started++;
      if (inWeek(subscription.trial_end)) {
        if (subscription.status === 'active' || subscription.status === 'past_due') trials.converted++;
        else if (subscription.status === 'canceled') trials.cancelled++;
      }
      if (subscription.status !== 'active') continue;
      stripePaying++;
      for (const item of subscription.items.data) {
        const price = item.price;
        if (price.currency !== 'eur' || !price.unit_amount || !price.recurring) continue;
        const perMonth = price.recurring.interval === 'year' ? price.unit_amount / 12 : price.recurring.interval === 'month' ? price.unit_amount : 0;
        mrrCents += Math.round(perMonth * (item.quantity ?? 1) / price.recurring.interval_count);
      }
    }
  }

  return {
    from,
    to,
    accounts: { total, thisWeek, lastWeek, bySource: [...bySource].map((row) => ({ source: row.source, count: Number(row.n) })) },
    activation: { accounts: activationAccounts, plan, receiptOrBill },
    trials,
    premium: { stripe: stripePaying, store, comp, mrrCents },
    households: { total: households, covered },
  };
}
