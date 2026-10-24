import { addDays, daysBetween, fromUtcDate, type LocalDate, toUtcDate } from '@/lib/dates/local-date';
import { sumCents, toCents } from '@/lib/money';
import { BillingSchedule, collectionDate, isAutoPaid } from '@/lib/schedule/billing-schedule';
import { inBucket, monthlyPayDay, type PaySchedule, type Period, paydaysDueAndPaid } from '@/lib/schedule/pay-schedule';

/**
 * The monthly plan, as a pure function of its inputs (lib/services/plan-service.ts loads them).
 *
 * It works like a monthly budget sheet: the period's income, minus every planned outgoing in the
 * period (recurring bills and subscriptions, paid or not; one-off entries; savings set-asides), is
 * what remains, and the weekly split is that over the period's whole weeks. With bank balances
 * entered it also works out what is left until payday from the money actually there.
 *
 * Money is integer cents throughout. Lines in another currency are listed but never added in:
 * there is no conversion.
 */

export type IncomeLike = PaySchedule & {
  id: string;
  name: string;
  amount: string;
  currency: string;
  isPrimary: boolean;
  status: string;
  intoAccountId: string | null;
  userId: string;
  householdId: string | null;
};

export type RecurringLike = {
  id: string;
  name: string;
  kind: string;
  category: string | null;
  amount: string;
  amountType: string;
  currency: string;
  status: string;
  paymentMethod: string | null;
  paidFromAccountId: string | null;
  billingFrequency: string;
  billingDay: number;
  customFrequencyDays: number | null;
  startDate: Date;
  endDate: Date | null;
  userId: string;
  householdId: string | null;
};

export type PaymentLike = {
  id: string;
  expectedDate: Date;
  dueDate: string | null;
  expectedAmount: string;
  amountSource: string;
  currency: string | null;
  status: string;
  actualDate: Date | null;
  actualAmount: string | null;
  paidVia: string | null;
  /** Who last set the status by hand; null when the daily job did. */
  markedByUserId?: string | null;
  /** When the row last changed: for a paid row, when it was marked paid (or edited since). */
  updatedAt?: Date | string | null;
};

export type EntryLike = {
  id: string;
  date: LocalDate;
  label: string;
  amount: string;
  currency: string;
  direction: string;
  category: string | null;
  notes?: string | null;
  doneAt: Date | null;
  userId: string;
  householdId: string | null;
};

export type GoalLike = {
  id: string;
  name: string;
  targetAmount: string | null;
  currency: string;
  targetDate: LocalDate | null;
  contributionPerCycle: string | null;
  savedAmount: string;
  /** A savings account whose balance is what's saved, instead of savedAmount. */
  linkedAccountId?: string | null;
  status: string;
  userId: string;
  householdId: string | null;
};

export type ContributionLike = { id: string; goalId: string; amount: string; contributedOn: LocalDate; createdAt?: Date | string | null };

export type AccountLike = {
  id: string;
  name: string;
  kind: string;
  currency: string;
  includeInPlan: boolean;
  archivedAt: Date | null;
  /** recordedAt: when it was typed in, to tell what was ticked off before and after it that day. */
  latestBalance: { balance: string; asOfDate: LocalDate; recordedAt?: Date | string | null } | null;
};

export type PlanInput = {
  today: LocalDate;
  period: Period;
  currency: string;
  incomes: IncomeLike[];
  recurring: Array<{ subscription: RecurringLike; payments: PaymentLike[]; recentPaidAmounts: string[] }>;
  entries: EntryLike[];
  goals: Array<{ goal: GoalLike; contributions: ContributionLike[] }>;
  accounts: AccountLike[];
};

export type LineStatus = 'planned' | 'paid' | 'overdue' | 'skipped' | 'done';

export type PlanLine = {
  key: string;
  source: 'income' | 'recurring' | 'entry' | 'goal';
  sourceId: string;
  label: string;
  date: LocalDate;
  amountCents: number;
  currency: string;
  direction: 'in' | 'out';
  status: LineStatus;
  /** The amount is a guess: a variable bill with no bill yet, or the usual amount. */
  estimated: boolean;
  /** Counted in the totals. False for skipped lines and lines in another currency. */
  counted: boolean;
  notCountedReason?: 'other_currency' | 'skipped';
  /** recurring: the cycle date that identifies the occurrence (PUT /api/subscriptions/[id]/occurrences). */
  cycleDate?: LocalDate;
  paymentId?: string | null;
  paidVia?: string | null;
  /** The day a paid or done line actually went out, when known. */
  settledOn?: LocalDate;
  /** When it was ticked off (ISO), to compare with a balance typed in the same day. */
  settledAt?: string;
  /** goal: the contributions recorded in this period (undo removes them). */
  contributionIds?: string[];
  kind?: string;
  category?: string | null;
  /** entry: its notes, for the edit dialog. */
  notes?: string | null;
  /** A filed bill (uploaded or emailed) that set this line, for a "From bill" link. Set by plan-service. */
  billDocumentId?: string;
  paymentMethod?: string | null;
  accountId?: string | null;
  ownerUserId: string;
  householdId: string | null;
};

export type BalanceView = {
  startingCents: number;
  accounts: Array<{ id: string; name: string; balanceCents: number; asOfDate: LocalDate; stale: boolean }>;
  /** Income still to arrive before the period ends (after each account's balance date). */
  incomingCents: number;
  /** Outgoings still to leave before the period ends. */
  outgoingCents: number;
  availableCents: number;
  /** What's left a day and a week until payday; null when nothing is left (a shortfall). */
  perDayCents: number | null;
  perWeekCents: number | null;
  daysLeft: number;
  /** Lines dated before the balance that are assumed to have left already (direct debits etc.). */
  assumedOutKeys: string[];
  notCountedAccounts: Array<{ id: string; name: string; reason: 'other_currency' | 'excluded' | 'no_balance' }>;
};

export type GoalSummary = {
  id: string;
  name: string;
  /** Typed in (raised by contributions), or the linked account's balance plus what was put in since. */
  savedCents: number;
  /** The account whose balance is used for savedCents, when linked and it has one. */
  linkedAccount: { id: string; name: string; asOfDate: LocalDate } | null;
  targetCents: number | null;
  perCycleCents: number | null;
  targetDate: LocalDate | null;
  /** Per period needed from now to reach the target by its date; null without both. */
  neededPerCycleCents: number | null;
  onTrack: boolean | null;
};

export type PlanResult = {
  period: Period;
  currency: string;
  lines: PlanLine[];
  totals: {
    incomeCents: number;
    outgoingCents: number;
    remainingCents: number;
    weeklyCents: number;
    /** Outgoings already paid or done, and still to go. */
    paidOutCents: number;
    toGoCents: number;
  };
  /** Days from today to the end of the period, if today is in it. */
  daysLeft: number | null;
  flags: Array<'no_income' | 'estimates' | 'overdue' | 'other_currency' | 'stale_balance'>;
  balance: BalanceView | null;
  goals: GoalSummary[];
};

const MISSED_GRACE_DAYS = 3;
const STALE_BALANCE_DAYS = 7;

function cents(value: string | null | undefined): number | null {
  return toCents(value ?? null);
}

function isoOf(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * Whether something that went out on `day` (ticked off at `at`) came after a balance, so the
 * balance doesn't show it yet. On the balance's own day it depends on which was typed first:
 * comparing days alone took a tick made after typing the balance as already in it, so ticking
 * off the €320 food shop raised "left until payday" by €320. Without both times, a same-day
 * item is taken as in the balance, as before.
 */
function afterBalance(
  day: LocalDate,
  at: string | undefined,
  balance: { asOfDate: LocalDate; recordedAt?: Date | string | null },
): boolean {
  if (day !== balance.asOfDate) return day > balance.asOfDate;
  const recordedAt = isoOf(balance.recordedAt);
  return Boolean(at && recordedAt && at > recordedAt);
}

function average(values: number[]): number {
  return Math.round(sumCents(values) / values.length);
}

function inPeriod(day: LocalDate, period: Period): boolean {
  return day >= period.start && day < period.end;
}

/**
 * Which recurring occurrences and paydays a computation takes: those dated in [from, to) that
 * `has` accepts. The sheet takes the period's bucket (paydays as due, so a weekend move never
 * shifts a bill between months); the bank check takes the days money really moves, up to the
 * real next payday.
 */
type Window = { from: LocalDate; to: LocalDate; has: (day: LocalDate, dayOfMonth?: number | null) => boolean; byDue: boolean };

function sheetWindow(period: Period): Window {
  return {
    from: period.start < period.bucket.start ? period.start : period.bucket.start,
    to: period.end > period.bucket.end ? period.end : period.bucket.end,
    has: (day, dayOfMonth) => inBucket(period, day, dayOfMonth),
    byDue: true,
  };
}

function cashWindow(period: Period): Window {
  return { from: period.start, to: period.end, has: (day) => inPeriod(day, period), byDue: false };
}

const MONTHLY_KINDS = ['monthly', 'bimonthly', 'quarterly', 'six_monthly', 'yearly'];

/** The billing day of a bill that repeats on a day of the month, for bucketing a clamped cycle date. */
function billingDayOfMonth(subscription: RecurringLike): number | null {
  return MONTHLY_KINDS.includes(subscription.billingFrequency) ? subscription.billingDay : null;
}

/** The amount of an occurrence that hasn't been paid: a bill's figure, else the usual or average. */
function unpaidAmount(
  subscription: RecurringLike,
  payment: PaymentLike | null,
  recentPaidAmounts: string[],
): { amountCents: number | null; estimated: boolean } {
  if (payment && (payment.amountSource === 'bill' || payment.amountSource === 'manual')) {
    return { amountCents: cents(payment.expectedAmount), estimated: false };
  }
  if (subscription.amountType === 'variable') {
    const recent = recentPaidAmounts.map((amount) => cents(amount)).filter((value): value is number => value !== null).slice(0, 3);
    if (recent.length > 0) return { amountCents: average(recent), estimated: true };
    return { amountCents: cents(subscription.amount), estimated: true };
  }
  return { amountCents: cents(subscription.amount), estimated: false };
}

function recurringLines(input: PlanInput, window: Window): PlanLine[] {
  const { today } = input;
  const lines: PlanLine[] = [];
  const graceCutoff = addDays(today, -MISSED_GRACE_DAYS);

  for (const { subscription, payments, recentPaidAmounts } of input.recurring) {
    const schedule = new BillingSchedule(subscription);
    const tolerance = schedule.matchToleranceMs;
    const base = {
      source: 'recurring' as const,
      sourceId: subscription.id,
      label: subscription.name,
      direction: 'out' as const,
      kind: subscription.kind,
      category: subscription.category,
      paymentMethod: subscription.paymentMethod,
      accountId: subscription.paidFromAccountId,
      ownerUserId: subscription.userId,
      householdId: subscription.householdId,
    };
    const automatic = isAutoPaid(subscription.paymentMethod);
    const dayOfMonth = billingDayOfMonth(subscription);

    // Rows that exist: bucketed by the day the money goes (a bill's due date, else the cycle).
    for (const payment of payments) {
      const cycleDate = fromUtcDate(new Date(payment.expectedDate));
      const day = payment.dueDate ?? cycleDate;
      if (!window.has(day, payment.dueDate ? null : dayOfMonth)) continue;

      const currency = payment.currency ?? subscription.currency;
      if (payment.status === 'skipped' || payment.status === 'cancelled') {
        lines.push({
          ...base, key: `sub:${subscription.id}:${cycleDate}`, date: day, cycleDate, paymentId: payment.id,
          amountCents: cents(payment.expectedAmount) ?? 0, currency, status: 'skipped', estimated: false,
          counted: false, notCountedReason: 'skipped', paidVia: payment.paidVia,
        });
        continue;
      }
      if (payment.status === 'paid') {
        lines.push({
          ...base, key: `sub:${subscription.id}:${cycleDate}`, date: day, cycleDate, paymentId: payment.id,
          amountCents: cents(payment.actualAmount) ?? cents(payment.expectedAmount) ?? 0, currency,
          status: 'paid', estimated: false, counted: true, paidVia: payment.paidVia,
          settledOn: payment.actualDate ? fromUtcDate(new Date(payment.actualDate)) : day,
          settledAt: isoOf(payment.updatedAt),
        });
        continue;
      }
      const { amountCents, estimated } = unpaidAmount(subscription, payment, recentPaidAmounts);
      // An automatic payment is overdue only when someone said it didn't go out (a bounced direct
      // debit): missed, set by hand. A row the daily job marked missed before card payments counted
      // as automatic isn't; its next run marks those assumed paid.
      const overdue = automatic
        ? payment.status === 'missed' && Boolean(payment.markedByUserId)
        : payment.status === 'missed' || day < graceCutoff;
      lines.push({
        ...base, key: `sub:${subscription.id}:${cycleDate}`, date: day, cycleDate, paymentId: payment.id,
        amountCents: amountCents ?? 0, currency, status: overdue ? 'overdue' : 'planned', estimated,
        counted: true, paidVia: payment.paidVia,
      });
    }

    // Cycles with no row yet (the future, or a dev database the daily job never ran on).
    if (subscription.status !== 'active') continue;
    const existing = payments.map((payment) => toUtcDate(fromUtcDate(new Date(payment.expectedDate))).getTime());
    const cycles = schedule.cyclesBetween(new Date(toUtcDate(window.from).getTime() - 1), toUtcDate(window.to));
    for (const cycle of cycles) {
      if (existing.some((time) => Math.abs(time - cycle.getTime()) <= tolerance)) continue;
      const cycleDate = fromUtcDate(cycle);
      if (!window.has(cycleDate, dayOfMonth)) continue;
      const { amountCents, estimated } = unpaidAmount(subscription, null, recentPaidAmounts);
      lines.push({
        ...base, key: `sub:${subscription.id}:${cycleDate}`, date: cycleDate, cycleDate, paymentId: null,
        amountCents: amountCents ?? 0, currency: subscription.currency,
        status: !automatic && cycleDate < graceCutoff ? 'overdue' : 'planned', estimated, counted: true,
      });
    }
  }
  return lines;
}

function incomeLines(input: PlanInput, window: Window): PlanLine[] {
  const lines: PlanLine[] = [];
  // The sheet takes a monthly payday by the day it was due (see Period.bucket) when the period
  // itself is bucketed that way; anything else goes by the day it is paid.
  const byDue = window.byDue && input.period.bucket.dayOfMonth !== null;
  for (const income of input.incomes) {
    if (income.status !== 'active') continue;
    const amountCents = cents(income.amount) ?? 0;
    const payDay = monthlyPayDay(income);
    for (const { due, paid: day } of paydaysDueAndPaid(income, addDays(window.from, -10), addDays(window.to, 10))) {
      if (!(byDue && payDay !== null ? window.has(due, payDay) : window.has(day))) continue;
      lines.push({
        key: `income:${income.id}:${day}`, source: 'income', sourceId: income.id, label: income.name, date: day,
        amountCents, currency: income.currency, direction: 'in', status: day <= input.today ? 'paid' : 'planned',
        estimated: false, counted: true, accountId: income.intoAccountId, ownerUserId: income.userId,
        householdId: income.householdId,
      });
    }
  }
  return lines;
}

/**
 * One-offs belong to the period their own date falls in, between the real paydays (not the
 * bucket's as-due ones). They have no schedule for a weekend to move, and the dialogs date a new
 * one on the period's first day, the real payday: bucketing by the due paydays would put
 * something added to November on Friday 23 October back in October.
 */
function entryLines(input: PlanInput): PlanLine[] {
  return input.entries
    .filter((entry) => inPeriod(entry.date, input.period))
    .map((entry) => ({
      key: `entry:${entry.id}`, source: 'entry' as const, sourceId: entry.id, label: entry.label, date: entry.date,
      amountCents: cents(entry.amount) ?? 0, currency: entry.currency,
      direction: entry.direction === 'in' ? 'in' as const : 'out' as const,
      status: entry.doneAt ? 'done' as const : 'planned' as const, estimated: false, counted: true,
      settledOn: entry.doneAt ? fromUtcDate(new Date(entry.doneAt)) : undefined,
      settledAt: isoOf(entry.doneAt),
      category: entry.category, notes: entry.notes ?? null, ownerUserId: entry.userId, householdId: entry.householdId,
    }));
}

function goalLines(input: PlanInput): PlanLine[] {
  const lines: PlanLine[] = [];
  for (const { goal, contributions } of input.goals) {
    if (goal.status !== 'active') continue;
    const inThisPeriod = contributions.filter((c) => inPeriod(c.contributedOn, input.period));
    const contributed = sumCents(inThisPeriod.map((c) => cents(c.amount)));
    const perCycle = cents(goal.contributionPerCycle);
    if (inThisPeriod.length === 0 && !perCycle) continue;
    lines.push({
      key: `goal:${goal.id}`, source: 'goal', sourceId: goal.id, label: goal.name, date: input.period.start,
      amountCents: inThisPeriod.length > 0 ? contributed : perCycle ?? 0, currency: goal.currency, direction: 'out',
      status: inThisPeriod.length > 0 ? 'done' : 'planned', estimated: false, counted: true,
      settledOn: inThisPeriod.length > 0 ? inThisPeriod.map((c) => c.contributedOn).sort().at(-1) : undefined,
      settledAt: inThisPeriod.map((c) => isoOf(c.createdAt)).filter((at): at is string => Boolean(at)).sort().at(-1),
      contributionIds: inThisPeriod.map((c) => c.id),
      ownerUserId: goal.userId, householdId: goal.householdId,
    });
  }
  return lines;
}

/**
 * What a goal has saved. With a linked account that has a balance (in the goal's currency), that
 * balance, plus contributions ticked off since it was typed in, which it can't show yet; else the
 * typed-in figure, which contributions raise. Only accounts in the plan's scope are looked at, so
 * a goal shared with a household never reveals a personal account's balance.
 */
function goalSaved(input: PlanInput, goal: GoalLike, contributions: ContributionLike[]): Pick<GoalSummary, 'savedCents' | 'linkedAccount'> {
  const account = goal.linkedAccountId
    ? input.accounts.find((a) => a.id === goal.linkedAccountId && !a.archivedAt && a.currency === goal.currency)
    : undefined;
  const balance = account?.latestBalance;
  const balanceCents = balance ? cents(balance.balance) : null;
  if (!account || !balance || balanceCents === null) return { savedCents: cents(goal.savedAmount) ?? 0, linkedAccount: null };
  const since = contributions.filter((c) => afterBalance(c.contributedOn, isoOf(c.createdAt), balance));
  return {
    savedCents: balanceCents + sumCents(since.map((c) => cents(c.amount))),
    linkedAccount: { id: account.id, name: account.name, asOfDate: balance.asOfDate },
  };
}

function goalSummaries(input: PlanInput): GoalSummary[] {
  return input.goals
    .filter(({ goal }) => goal.status === 'active' || goal.status === 'paused' || goal.status === 'achieved')
    .map(({ goal, contributions }) => {
      const { savedCents, linkedAccount } = goalSaved(input, goal, contributions);
      const targetCents = cents(goal.targetAmount);
      const perCycleCents = cents(goal.contributionPerCycle);
      let neededPerCycleCents: number | null = null;
      if (targetCents !== null && goal.targetDate) {
        // Periods left at roughly a month each, counting this one until its contribution is made.
        // Once it is, the saved figure already includes it: counting this period as well spread
        // what's left over one period too many (16,000 over 9, not 8).
        const contributed = contributions.some((c) => inPeriod(c.contributedOn, input.period));
        const periods = Math.ceil(daysBetween(input.period.start, goal.targetDate) / 30.44) - (contributed ? 1 : 0);
        neededPerCycleCents = Math.max(0, Math.ceil((targetCents - savedCents) / Math.max(1, periods)));
      }
      return {
        id: goal.id,
        name: goal.name,
        savedCents,
        linkedAccount,
        targetCents,
        perCycleCents,
        targetDate: goal.targetDate,
        neededPerCycleCents,
        onTrack: neededPerCycleCents === null ? null : (perCycleCents ?? 0) >= neededPerCycleCents,
      };
    });
}

/**
 * What is left until payday from the money in the bank, when balances are entered. A flow counts
 * when it falls after its account's balance date and before the period ends: anything earlier is
 * already in the balance. Unpaid manual bills from before the balance are still owed; unpaid
 * direct debits and the like from before it are assumed to have gone out.
 */
function balanceView(input: PlanInput, lines: PlanLine[]): BalanceView | null {
  // `lines` are the cash lines: occurrences between the real paydays, which can differ from the
  // sheet's (a bill on the 24th belongs to October's sheet but leaves before November's payday).
  const { period, today, currency } = input;
  if (!inPeriod(today, period)) return null;

  const live = input.accounts.filter((account) => !account.archivedAt);
  const counted = live.filter((account) =>
    account.includeInPlan && account.currency === currency && account.latestBalance && cents(account.latestBalance.balance) !== null);
  if (counted.length === 0) return null;

  const notCountedAccounts = live
    .filter((account) => !counted.includes(account))
    .map((account) => ({
      id: account.id,
      name: account.name,
      reason: account.currency !== currency ? 'other_currency' as const
        : !account.includeInPlan ? 'excluded' as const : 'no_balance' as const,
    }));

  const asOf = new Map(counted.map((account) => [account.id, account.latestBalance!.asOfDate]));
  const balanceOf = new Map(counted.map((account) => [account.id, account.latestBalance!]));
  const primaryInto = input.incomes.find((income) => income.isPrimary && income.status === 'active')?.intoAccountId;
  const defaultAccount = primaryInto && asOf.has(primaryInto)
    ? primaryInto
    : [...counted].sort((a, b) => b.latestBalance!.asOfDate.localeCompare(a.latestBalance!.asOfDate))[0].id;
  const accountFor = (line: PlanLine): string | null => {
    if (!line.accountId) return defaultAccount;
    return asOf.has(line.accountId) ? line.accountId : null;
  };

  let incomingCents = 0;
  let outgoingCents = 0;
  const assumedOutKeys: string[] = [];

  for (const line of lines) {
    if (!line.counted || line.currency !== currency) continue;
    const account = accountFor(line);
    if (!account) continue;
    const balanceDate = asOf.get(account)!;

    if (line.direction === 'in') {
      if (line.date > balanceDate) incomingCents += line.amountCents;
      continue;
    }
    // Paid or done after the balance was taken: the balance doesn't show it yet.
    if (line.status === 'paid' || line.status === 'done') {
      if (line.settledOn && afterBalance(line.settledOn, line.settledAt, balanceOf.get(account)!)) outgoingCents += line.amountCents;
      continue;
    }
    if (line.source === 'entry' || line.source === 'goal') {
      // One-offs and set-asides have no real date: they are still to go until marked done.
      outgoingCents += line.amountCents;
      continue;
    }
    const automatic = isAutoPaid(line.paymentMethod);
    const collected = automatic ? collectionDate(line.date, line.paymentMethod) : line.date;
    if (collected > balanceDate) {
      outgoingCents += line.amountCents;
    } else if (automatic && line.status !== 'overdue') {
      // (An overdue automatic payment is one marked as not gone out: still owed, so not this.)
      assumedOutKeys.push(line.key);
    } else {
      outgoingCents += line.amountCents; // an unpaid manual bill is still owed
    }
  }

  const startingCents = sumCents(counted.map((account) => cents(account.latestBalance!.balance)));
  const availableCents = startingCents + incomingCents - outgoingCents;
  const daysLeft = Math.max(1, daysBetween(today, period.end));
  const stale = (day: LocalDate) => daysBetween(day, today) > STALE_BALANCE_DAYS || day < period.start;

  return {
    startingCents,
    accounts: counted.map((account) => ({
      id: account.id,
      name: account.name,
      balanceCents: cents(account.latestBalance!.balance) ?? 0,
      asOfDate: account.latestBalance!.asOfDate,
      stale: stale(account.latestBalance!.asOfDate),
    })),
    incomingCents,
    outgoingCents,
    availableCents,
    // A shortfall has nothing to split: "€0.00 a week" under −€3,249.72 read as if it were fine.
    perDayCents: availableCents < 0 ? null : Math.floor(availableCents / daysLeft),
    perWeekCents: availableCents < 0 ? null : Math.floor((availableCents * 7) / daysLeft),
    daysLeft,
    assumedOutKeys,
    notCountedAccounts,
  };
}

const SOURCE_ORDER: Record<PlanLine['source'], number> = { income: 0, recurring: 1, goal: 2, entry: 3 };

function markOtherCurrency(input: PlanInput, line: PlanLine): PlanLine {
  return line.counted && line.currency !== input.currency
    ? { ...line, counted: false, notCountedReason: 'other_currency' as const }
    : line;
}

export function computePlan(input: PlanInput): PlanResult {
  const sheet = sheetWindow(input.period);
  const oneOffs = [...goalLines(input), ...entryLines(input)];
  const all = [...incomeLines(input, sheet), ...recurringLines(input, sheet), ...oneOffs];

  const lines = all
    .map((line) => markOtherCurrency(input, line))
    .sort((a, b) =>
      (a.direction === b.direction ? 0 : a.direction === 'in' ? -1 : 1) ||
      SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] ||
      a.date.localeCompare(b.date) ||
      a.label.localeCompare(b.label));

  const counted = lines.filter((line) => line.counted);
  const incomeCents = sumCents(counted.filter((line) => line.direction === 'in').map((line) => line.amountCents));
  const outgoing = counted.filter((line) => line.direction === 'out');
  const outgoingCents = sumCents(outgoing.map((line) => line.amountCents));
  const paidOutCents = sumCents(outgoing.filter((line) => line.status === 'paid' || line.status === 'done').map((line) => line.amountCents));
  const remainingCents = incomeCents - outgoingCents;

  const flags: PlanResult['flags'] = [];
  if (!input.incomes.some((income) => income.status === 'active')) flags.push('no_income');
  if (outgoing.some((line) => line.estimated)) flags.push('estimates');
  if (outgoing.some((line) => line.status === 'overdue')) flags.push('overdue');
  if (lines.some((line) => line.notCountedReason === 'other_currency')) flags.push('other_currency');

  const cash = cashWindow(input.period);
  const cashLines = [...incomeLines(input, cash), ...recurringLines(input, cash), ...oneOffs]
    .map((line) => markOtherCurrency(input, line));
  const balance = balanceView(input, cashLines);
  if (balance?.accounts.some((account) => account.stale)) flags.push('stale_balance');

  return {
    period: input.period,
    currency: input.currency,
    lines,
    totals: {
      incomeCents,
      outgoingCents,
      remainingCents,
      weeklyCents: Math.round(remainingCents / input.period.weeks),
      paidOutCents,
      toGoCents: outgoingCents - paidOutCents,
    },
    daysLeft: inPeriod(input.today, input.period) ? daysBetween(input.today, input.period.end) : null,
    flags,
    balance,
    goals: goalSummaries(input),
  };
}
