import { and, desc, eq, gte, inArray, lt, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  financialAccounts,
  incomeSources,
  planEntries,
  savingsGoalContributions,
  savingsGoals,
  subscriptionPayments,
  subscriptions,
  type IncomeSource,
  type User,
} from '@/lib/db/schema';
import { addDays, type LocalDate, toUtcDate } from '@/lib/dates/local-date';
import { computePlan, type PlanResult } from '@/lib/plan/compute-plan';
import { periodAt, type Period } from '@/lib/schedule/pay-schedule';
import { latestBalances } from '@/lib/services/account-service';
import { type FinanceEntitlements, financeScopeCondition, type FinanceScope } from '@/lib/services/finance-access';

/** Payment rows this far either side of a period are loaded, so a due date that moved a bill across the boundary is seen. */
const ROW_MARGIN_DAYS = 40;
/** Variable bills are estimated from this many recent payments. */
const RECENT_PAID = 3;
/** "Your usual items": the most-used entry labels from this far back. */
const SUGGESTION_LOOKBACK_DAYS = 400;
const MAX_SUGGESTIONS = 30;

export type PlanResponse = PlanResult & {
  scope: FinanceScope;
  /** Labels used before that aren't in this period yet, most used first: quick picks for adding. */
  suggestions: string[];
  /** The viewer's primary income, which sets the period; null without one. */
  primaryIncome: Pick<IncomeSource, 'id' | 'name' | 'amount' | 'currency' | 'frequency' | 'payDay' | 'anchorDate' | 'weekendRule'> | null;
};

/** The viewer's own primary income, which sets the period whatever the scope. */
export async function getPrimaryIncome(userId: string): Promise<IncomeSource | null> {
  const [primary] = await db
    .select()
    .from(incomeSources)
    .where(and(eq(incomeSources.userId, userId), eq(incomeSources.isPrimary, true), eq(incomeSources.status, 'active')))
    .limit(1);
  return primary ?? null;
}

export async function getPeriod(userId: string, today: LocalDate, offset: number): Promise<Period> {
  return periodAt(await getPrimaryIncome(userId), today, offset);
}

/**
 * Load everything in scope for one period and compute the plan. Returns null when the user may
 * not see the scope (the route answers 403).
 */
export async function loadPlan(
  user: User,
  entitlements: FinanceEntitlements,
  scope: FinanceScope,
  today: LocalDate,
  offset: number,
): Promise<PlanResponse | null> {
  const conditions = {
    incomes: financeScopeCondition(incomeSources, user.id, scope, entitlements),
    subscriptions: financeScopeCondition(subscriptions, user.id, scope, entitlements),
    entries: financeScopeCondition(planEntries, user.id, scope, entitlements),
    goals: financeScopeCondition(savingsGoals, user.id, scope, entitlements),
    accounts: financeScopeCondition(financialAccounts, user.id, scope, entitlements),
  };
  if (!conditions.incomes || !conditions.subscriptions || !conditions.entries || !conditions.goals || !conditions.accounts) {
    return null;
  }

  const primary = await getPrimaryIncome(user.id);
  const period = periodAt(primary, today, offset);

  const [incomes, subs, entries, goals, accounts] = await Promise.all([
    db.select().from(incomeSources).where(conditions.incomes),
    db.select().from(subscriptions).where(and(conditions.subscriptions, ne(subscriptions.status, 'cancelled'))),
    db.select().from(planEntries).where(and(conditions.entries, gte(planEntries.date, period.start), lt(planEntries.date, period.end))),
    db.select().from(savingsGoals).where(conditions.goals),
    db.select().from(financialAccounts).where(conditions.accounts),
  ]);

  // Cancelled subscriptions still count for any row in the period (a final payment); fetch those too.
  const cancelledWithRows = await db
    .selectDistinct({ subscription: subscriptions })
    .from(subscriptions)
    .innerJoin(subscriptionPayments, eq(subscriptionPayments.subscriptionId, subscriptions.id))
    .where(and(
      conditions.subscriptions,
      eq(subscriptions.status, 'cancelled'),
      gte(subscriptionPayments.expectedDate, toUtcDate(addDays(period.start, -ROW_MARGIN_DAYS))),
      lt(subscriptionPayments.expectedDate, toUtcDate(addDays(period.end, ROW_MARGIN_DAYS))),
    ));
  const allSubs = [...subs, ...cancelledWithRows.map((row) => row.subscription)];
  const subIds = allSubs.map((sub) => sub.id);

  const [payments, paidHistory, contributions, latestBalance, suggestionRows] = await Promise.all([
    subIds.length === 0 ? [] : db
      .select()
      .from(subscriptionPayments)
      .where(and(
        inArray(subscriptionPayments.subscriptionId, subIds),
        gte(subscriptionPayments.expectedDate, toUtcDate(addDays(period.start, -ROW_MARGIN_DAYS))),
        lt(subscriptionPayments.expectedDate, toUtcDate(addDays(period.end, ROW_MARGIN_DAYS))),
      )),
    subIds.length === 0 ? [] : db
      .select({ subscriptionId: subscriptionPayments.subscriptionId, actualAmount: subscriptionPayments.actualAmount, expectedAmount: subscriptionPayments.expectedAmount })
      .from(subscriptionPayments)
      .where(and(inArray(subscriptionPayments.subscriptionId, subIds), eq(subscriptionPayments.status, 'paid')))
      .orderBy(desc(subscriptionPayments.expectedDate)),
    goals.length === 0 ? [] : db
      .select()
      .from(savingsGoalContributions)
      .where(inArray(savingsGoalContributions.goalId, goals.map((goal) => goal.id))),
    latestBalances(accounts.map((account) => account.id)),
    db
      .select({ label: planEntries.label })
      .from(planEntries)
      .where(and(conditions.entries, gte(planEntries.date, addDays(today, -SUGGESTION_LOOKBACK_DAYS)))),
  ]);

  const recentPaid = new Map<string, string[]>();
  for (const row of paidHistory) {
    const list = recentPaid.get(row.subscriptionId) ?? [];
    if (list.length < RECENT_PAID) list.push(row.actualAmount ?? row.expectedAmount);
    recentPaid.set(row.subscriptionId, list);
  }

  const result = computePlan({
    today,
    period,
    currency: user.currency || 'EUR',
    incomes,
    recurring: allSubs.map((subscription) => ({
      subscription,
      payments: payments.filter((payment) => payment.subscriptionId === subscription.id),
      recentPaidAmounts: recentPaid.get(subscription.id) ?? [],
    })),
    entries,
    goals: goals.map((goal) => ({ goal, contributions: contributions.filter((c) => c.goalId === goal.id) })),
    accounts: accounts.map((account) => ({ ...account, latestBalance: latestBalance.get(account.id) ?? null })),
  });

  // Usual items: labels used before, most used first, leaving out what's already in this period.
  const inPeriod = new Set(result.lines.map((line) => line.label.trim().toLowerCase()));
  const counts = new Map<string, { label: string; count: number }>();
  for (const { label } of suggestionRows) {
    const key = label.trim().toLowerCase();
    if (inPeriod.has(key)) continue;
    const existing = counts.get(key);
    counts.set(key, { label: existing?.label ?? label.trim(), count: (existing?.count ?? 0) + 1 });
  }
  const suggestions = [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, MAX_SUGGESTIONS)
    .map((item) => item.label);

  return {
    ...result,
    scope,
    suggestions,
    primaryIncome: primary && {
      id: primary.id,
      name: primary.name,
      amount: primary.amount,
      currency: primary.currency,
      frequency: primary.frequency,
      payDay: primary.payDay,
      anchorDate: primary.anchorDate,
      weekendRule: primary.weekendRule,
    },
  };
}
