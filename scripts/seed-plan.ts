// Fill an empty account's plan from what someone already keeps elsewhere, like a spreadsheet:
// their pay, regular bills, savings, and the lines and bill amounts of the months they've planned.
//
//   npx tsx scripts/seed-plan.ts <email or user id> < plan.json            # what it would add
//   npx tsx scripts/seed-plan.ts <email or user id> --apply < plan.json    # add it
//
// Against the database in DATABASE_URL. It refuses an account that already has pay, bills,
// savings goals or plan lines, so nothing is added twice. Everything is personal (no household);
// lines can be shared from the app afterwards. The plan comes on stdin, so the figures never sit
// in a file:
//
//   {
//     "pay": { "name": "Salary", "amount": "3000", "payDay": 25 },
//     "bills": [{ "name": "Car loan", "amount": "400", "day": 1, "method": "direct_debit" },
//               { "name": "Credit card", "amount": "0", "day": 1, "variable": true },
//               { "name": "Rent", "amount": "900", "day": 1, "fromMonth": 1 }],
//     "savings": [{ "name": "Savings", "perMonth": "500" }],
//     "months": [{ "month": 0, "lines": [["Birthday present", "60"]], "billAmounts": { "Credit card": "650" } }]
//   }
//
// `month` and `fromMonth` count from the period today is in (0), as the plan's arrows do. Every
// bill is monthly, essential (kind 'bill') and paid by direct debit unless it says otherwise.

import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { incomeSources, planEntries, savingsGoals, subscriptions, users } from '../lib/db/schema';
import { localToday, type LocalDate } from '../lib/dates/local-date';
import { firstBillDate } from '../lib/plan/new-bill';
import { periodAt, type Period } from '../lib/schedule/pay-schedule';
import { getFinanceEntitlements } from '../lib/services/finance-access';
import { loadPlan } from '../lib/services/plan-service';
import { SubscriptionService } from '../lib/services/subscription-service';
import { formatCents } from '../lib/utils/currency';
import {
  createEntrySchema,
  createGoalSchema,
  createIncomeSchema,
  createSubscriptionSchema,
} from '../lib/validation/finance';

type SeedBill = { name: string; amount: string; day: number; variable?: boolean; method?: string; kind?: 'bill' | 'subscription'; fromMonth?: number };
type Seed = {
  pay: { name: string; amount: string; payDay: number };
  bills: SeedBill[];
  savings: Array<{ name: string; perMonth: string }>;
  months: Array<{ month: number; lines?: Array<[string, string]>; billAmounts?: Record<string, string> }>;
};

async function readStdin(): Promise<string> {
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text;
}

/** The day a month's lines are dated: today in the current period, else the period's first day. */
function lineDay(period: Period, today: LocalDate): LocalDate {
  return today >= period.start && today < period.end ? today : period.start;
}

async function main() {
  const who = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!who || who.startsWith('--')) throw new Error('Usage: npx tsx scripts/seed-plan.ts <email or user id> [--apply] < plan.json');
  const seed = JSON.parse(await readStdin()) as Seed;

  const byId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(who);
  const [user] = await db.select().from(users).where(byId ? eq(users.id, who) : eq(users.email, who.toLowerCase())).limit(1);
  if (!user) throw new Error(`No account for ${who}`);
  if (!user.subscribed) console.warn('Warning: this account has no Premium, so the plan won\'t open for it.');

  const [hasIncome, hasBills, hasGoals, hasLines] = await Promise.all([
    db.select({ id: incomeSources.id }).from(incomeSources).where(eq(incomeSources.userId, user.id)).limit(1),
    db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.userId, user.id)).limit(1),
    db.select({ id: savingsGoals.id }).from(savingsGoals).where(eq(savingsGoals.userId, user.id)).limit(1),
    db.select({ id: planEntries.id }).from(planEntries).where(eq(planEntries.userId, user.id)).limit(1),
  ]);
  if (hasIncome.length || hasBills.length || hasGoals.length || hasLines.length) {
    throw new Error('This account already has a plan (pay, bills, savings or lines). Seeding is only for an empty one.');
  }

  // Everything is checked with the routes' own schemas before anything is written.
  const today = localToday();
  const income = createIncomeSchema.parse({ name: seed.pay.name, amount: seed.pay.amount, currency: user.currency, frequency: 'monthly', payDay: seed.pay.payDay, isPrimary: true });
  const schedule = { frequency: income.frequency, payDay: income.payDay ?? null, anchorDate: null, weekendRule: income.weekendRule };
  const periodOf = (month: number) => periodAt(schedule, today, month);

  const bills = seed.bills.map((bill) => ({
    seed: bill,
    input: createSubscriptionSchema.parse({
      name: bill.name,
      amount: bill.amount,
      currency: user.currency,
      billingFrequency: 'monthly',
      billingDay: bill.day,
      startDate: firstBillDate(periodOf(bill.fromMonth ?? 0), bill.day),
      kind: bill.kind ?? 'bill',
      amountType: bill.variable ? 'variable' : 'fixed',
      paymentMethod: bill.method ?? 'direct_debit',
    }),
  }));
  const goals = seed.savings.map((goal) => createGoalSchema.parse({ name: goal.name, contributionPerCycle: goal.perMonth, currency: user.currency }));
  const months = seed.months.map((month) => {
    const period = periodOf(month.month);
    const unknown = Object.keys(month.billAmounts ?? {}).filter((name) => !bills.some((bill) => bill.seed.name === name));
    if (unknown.length) throw new Error(`billAmounts names no bill: ${unknown.join(', ')}`);
    return {
      ...month,
      period,
      lines: (month.lines ?? []).map(([label, amount]) => createEntrySchema.parse({ date: lineDay(period, today), label, amount, currency: user.currency })),
    };
  });

  const money = (amount: string) => formatCents(Math.round(Number(amount) * 100), user.currency);
  console.log(`${who}: pay ${money(income.amount)} on the ${income.payDay}th`);
  for (const { seed: bill, input } of bills) {
    console.log(`  bill ${bill.name} ${input.amountType === 'variable' ? 'usually ' : ''}${money(input.amount)} on day ${bill.day}, ${input.paymentMethod}, from ${input.startDate.toISOString().slice(0, 10)}`);
  }
  for (const goal of goals) console.log(`  savings ${goal.name} ${money(goal.contributionPerCycle ?? '0')} a month`);
  for (const month of months) {
    console.log(`  ${month.period.label} (${month.period.start} to ${month.period.end}):`);
    for (const line of month.lines) console.log(`    ${line.label} ${money(line.amount)} on ${line.date}`);
    for (const [name, amount] of Object.entries(month.billAmounts ?? {})) console.log(`    ${name} this month ${money(amount)}`);
  }
  if (!apply) {
    console.log('\nDry run: nothing written. Add --apply to write it.');
    return;
  }

  await db.insert(incomeSources).values({
    userId: user.id, householdId: null, name: income.name, amount: income.amount, currency: income.currency,
    frequency: income.frequency, payDay: income.payDay ?? null, anchorDate: null, weekendRule: income.weekendRule,
    isPrimary: true, intoAccountId: null, status: 'active',
  });

  const billIds = new Map<string, string>();
  for (const { seed: bill, input } of bills) {
    const scheduleFields = { startDate: input.startDate, billingFrequency: input.billingFrequency, billingDay: input.billingDay!, customFrequencyDays: null, endDate: null };
    const [row] = await db.insert(subscriptions).values({
      userId: user.id, householdId: null, name: input.name, amount: input.amount, currency: input.currency,
      ...scheduleFields, status: 'active', nextBillingDate: SubscriptionService.computeNextBillingDate(scheduleFields),
      isBusinessExpense: false, kind: input.kind, amountType: input.amountType, paymentMethod: input.paymentMethod ?? null,
    }).returning();
    await SubscriptionService.generateExpectedPayments(row.id);
    billIds.set(bill.name, row.id);
  }

  for (const goal of goals) {
    await db.insert(savingsGoals).values({
      userId: user.id, householdId: null, name: goal.name, currency: goal.currency ?? user.currency,
      contributionPerCycle: goal.contributionPerCycle ?? null, savedAmount: goal.savedAmount, status: goal.status,
    });
  }

  const entitlements = await getFinanceEntitlements(user);
  const now = new Date();
  for (const month of months) {
    if (month.lines.length) {
      await db.insert(planEntries).values(month.lines.map((line) => ({
        userId: user.id, householdId: null, date: line.date, label: line.label, amount: line.amount,
        currency: line.currency ?? user.currency, direction: line.direction, category: null, doneAt: line.done ? now : null, notes: null,
      })));
    }
    // A bill's amount for this month goes on its occurrence, as tapping the amount in the plan does.
    const plan = await loadPlan(user, entitlements, { type: 'mine' }, today, month.month);
    for (const [name, amount] of Object.entries(month.billAmounts ?? {})) {
      const line = plan?.lines.find((candidate) => candidate.source === 'recurring' && candidate.sourceId === billIds.get(name));
      if (!line?.cycleDate) throw new Error(`${name} has no line in ${month.period.label}`);
      const subscription = await SubscriptionService.getById(billIds.get(name)!);
      const occurrence = await SubscriptionService.findOrCreateOccurrence(subscription!, line.cycleDate);
      if (!occurrence) throw new Error(`${name}: ${line.cycleDate} isn't one of its billing dates`);
      await SubscriptionService.applyPaymentChange(occurrence, { expectedAmount: createEntrySchema.shape.amount.parse(amount) }, user.id);
    }
  }

  // What the plan now says, month by month, to check against the sheet.
  for (const month of months) {
    const plan = await loadPlan(user, entitlements, { type: 'mine' }, today, month.month);
    if (!plan) continue;
    const t = plan.totals;
    console.log(`\n${plan.period.label}: in ${formatCents(t.incomeCents, plan.currency)}, out ${formatCents(t.outgoingCents, plan.currency)}, left ${formatCents(t.remainingCents, plan.currency)}`);
    for (const line of plan.lines) {
      console.log(`  ${line.direction === 'in' ? '+' : '-'} ${line.label} ${line.estimated ? '~' : ''}${formatCents(line.amountCents, line.currency)} (${line.date}${line.estimated ? ', estimate' : ''})`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
