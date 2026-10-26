/**
 * The plan's building blocks, as the API returns them: income, savings goals and bank accounts.
 * Money is a string ("1234.50"), days are YYYY-MM-DD, instants are ISO strings.
 */

/** One of GET /api/income. */
export type WireIncome = {
  id: string;
  userId: string;
  householdId: string | null;
  name: string;
  amount: string;
  currency: string;
  /** 'monthly' | 'last_working_day' | 'weekly' | 'fortnightly' | 'four_weekly' */
  frequency: string;
  payDay: number | null;
  anchorDate: string | null;
  /** 'previous_business_day' | 'next_business_day' | 'none' */
  weekendRule: string;
  isPrimary: boolean;
  intoAccountId: string | null;
  /** 'active' | 'ended' */
  status: string;
};

/** One of GET /api/goals. */
export type WireGoal = {
  id: string;
  userId: string;
  householdId: string | null;
  name: string;
  targetAmount: string | null;
  currency: string;
  targetDate: string | null;
  contributionPerCycle: string | null;
  savedAmount: string;
  linkedAccountId: string | null;
  /** 'active' | 'paused' | 'achieved' | 'archived' */
  status: string;
};

/** One of GET /api/accounts, with its latest balance. */
export type WireAccount = {
  id: string;
  userId: string;
  householdId: string | null;
  name: string;
  /** 'current' | 'savings' | 'cash' */
  kind: string;
  currency: string;
  includeInPlan: boolean;
  archivedAt: string | null;
  latestBalance: { balance: string; asOfDate: string } | null;
};
