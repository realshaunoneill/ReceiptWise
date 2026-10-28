import { and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { subscriptionPayments, type Subscription } from '@/lib/db/schema';
import { BillingSchedule, utcDay } from '@/lib/schedule/billing-schedule';

/**
 * Each bill's next payment amount when that cycle has its own (read off a filed bill, or typed in
 * for that month), keyed by bill id; bills on their usual amount are left out. The lists showed
 * the usual amount, so a card bill that's usually €0 with €809 set for November said ~€0 while
 * the plan said €809. Sent as `nextAmount` beside `nextBillingDate`.
 */
export async function nextAmounts(rows: Subscription[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  if (rows.length === 0) return found;

  const own = await db
    .select({ subscriptionId: subscriptionPayments.subscriptionId, expectedDate: subscriptionPayments.expectedDate, expectedAmount: subscriptionPayments.expectedAmount })
    .from(subscriptionPayments)
    .where(and(
      inArray(subscriptionPayments.subscriptionId, rows.map((row) => row.id)),
      inArray(subscriptionPayments.amountSource, ['bill', 'manual']),
      inArray(subscriptionPayments.status, ['pending', 'missed']),
    ));

  for (const row of rows) {
    if (!row.nextBillingDate) continue;
    const next = utcDay(new Date(row.nextBillingDate)).getTime();
    const tolerance = new BillingSchedule(row).matchToleranceMs;
    const match = own.find((payment) => payment.subscriptionId === row.id
      && Math.abs(utcDay(new Date(payment.expectedDate)).getTime() - next) <= tolerance);
    if (match) found.set(row.id, match.expectedAmount);
  }
  return found;
}
