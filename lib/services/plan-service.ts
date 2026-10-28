import { and, desc, eq, gte, inArray, isNull, lt, ne, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  billDocuments,
  financialAccounts,
  incomeSources,
  planEntries,
  savingsGoalContributions,
  savingsGoals,
  subscriptionPayments,
  subscriptions,
  type IncomeSource,
  type User,
  planAmounts,
} from '@/lib/db/schema';
import { addDays, type LocalDate, toUtcDate } from '@/lib/dates/local-date';
import { computePlan, type PlanResult } from '@/lib/plan/compute-plan';
import { type UsualItem, usualItems } from '@/lib/plan/usual-items';
import { periodAt, type Period } from '@/lib/schedule/pay-schedule';
import { latestBalances } from '@/lib/services/account-service';
import { getPrimaryIncome } from '@/lib/services/income-service';
import { type FinanceEntitlements, financeScopeCondition, type FinanceScope } from '@/lib/services/finance-access';

/** Payment rows this far either side of a period are loaded, so a due date that moved a bill across the boundary is seen. */
const ROW_MARGIN_DAYS = 40;
/** Variable bills are estimated from this many recent payments. */
const RECENT_PAID = 3;
/** "Your usual items": the most-used one-off labels from this far before the period. */
const SUGGESTION_LOOKBACK_DAYS = 400;
const MAX_SUGGESTIONS = 30;

export type PlanResponse = PlanResult & {
  scope: FinanceScope;
  /** One-offs from earlier periods that aren't in this one yet, with their last amount: quick picks for adding. */
  suggestions: UsualItem[];
  /**
   * The viewer's primary income, which sets the period whatever the scope; null without one.
   * householdId says whether it's shared, so a household's plan can tell "no pay at all" from
   * "your pay isn't shared with this household".
   */
  primaryIncome: Pick<IncomeSource, 'id' | 'name' | 'amount' | 'currency' | 'frequency' | 'payDay' | 'anchorDate' | 'weekendRule' | 'householdId'> | null;
  /** How many active incomes the viewer has, in any scope. */
  viewerIncomeCount: number;
};

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

  const [primary, viewerIncomes] = await Promise.all([
    getPrimaryIncome(user.id),
    db.select({ id: incomeSources.id }).from(incomeSources)
      .where(and(eq(incomeSources.userId, user.id), eq(incomeSources.status, 'active'))),
  ]);
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

  // This month's own pay or savings amounts (plan_amounts), around the period's paydays.
  const incomeIds = incomes.map((income) => income.id);
  const goalIds = goals.map((goal) => goal.id);
  const overridesQuery = incomeIds.length + goalIds.length === 0 ? Promise.resolve([]) : db
    .select({ incomeId: planAmounts.incomeId, goalId: planAmounts.goalId, day: planAmounts.day, amount: planAmounts.amount })
    .from(planAmounts)
    .where(and(
      or(
        incomeIds.length ? inArray(planAmounts.incomeId, incomeIds) : undefined,
        goalIds.length ? inArray(planAmounts.goalId, goalIds) : undefined,
      ),
      gte(planAmounts.day, addDays(period.start, -ROW_MARGIN_DAYS)),
      lt(planAmounts.day, addDays(period.end, ROW_MARGIN_DAYS)),
    ));

  const [payments, paidHistory, contributions, latestBalance, suggestionRows, overrides] = await Promise.all([
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
      .select({ label: planEntries.label, amount: planEntries.amount, date: planEntries.date })
      .from(planEntries)
      .where(and(
        conditions.entries,
        gte(planEntries.date, addDays(period.start, -SUGGESTION_LOOKBACK_DAYS)),
        lt(planEntries.date, period.start),
      ))
      .orderBy(desc(planEntries.date)),
    overridesQuery,
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
    amounts: overrides.map((row) => row.goalId
      ? { source: 'goal' as const, sourceId: row.goalId, day: row.day, amount: row.amount }
      : { source: 'income' as const, sourceId: row.incomeId ?? '', day: row.day, amount: row.amount }),
  });

  const suggestions = usualItems(suggestionRows, period.start, result.lines.map((line) => line.label), MAX_SUGGESTIONS);

  // A bill filed from an upload or an email marks the line it set, with a link to the file.
  const paymentIds = result.lines.flatMap((line) => (line.paymentId ? [line.paymentId] : []));
  const entryIds = result.lines.flatMap((line) => (line.source === 'entry' ? [line.sourceId] : []));
  const documentCondition = financeScopeCondition(billDocuments, user.id, scope, entitlements);
  const filed = documentCondition && (paymentIds.length > 0 || entryIds.length > 0)
    ? await db
      .select({ id: billDocuments.id, paymentId: billDocuments.paymentId, entryId: billDocuments.entryId })
      .from(billDocuments)
      .where(and(
        documentCondition,
        isNull(billDocuments.deletedAt),
        eq(billDocuments.reviewStatus, 'applied'),
        or(
          paymentIds.length > 0 ? inArray(billDocuments.paymentId, paymentIds) : undefined,
          entryIds.length > 0 ? inArray(billDocuments.entryId, entryIds) : undefined,
        ),
      ))
      .orderBy(desc(billDocuments.createdAt))
    : [];
  const documentFor = new Map<string, string>();
  for (const document of filed) {
    const key = document.paymentId ? `payment:${document.paymentId}` : `entry:${document.entryId}`;
    if (!documentFor.has(key)) documentFor.set(key, document.id);
  }
  const lines = documentFor.size === 0 ? result.lines : result.lines.map((line) => {
    const billDocumentId = documentFor.get(line.paymentId ? `payment:${line.paymentId}` : `entry:${line.sourceId}`);
    return billDocumentId && (line.paymentId || line.source === 'entry') ? { ...line, billDocumentId } : line;
  });

  return {
    ...result,
    lines,
    scope,
    suggestions,
    viewerIncomeCount: viewerIncomes.length,
    primaryIncome: primary && {
      id: primary.id,
      name: primary.name,
      amount: primary.amount,
      currency: primary.currency,
      frequency: primary.frequency,
      payDay: primary.payDay,
      anchorDate: primary.anchorDate,
      weekendRule: primary.weekendRule,
      householdId: primary.householdId,
    },
  };
}
