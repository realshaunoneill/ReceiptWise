import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accountBalances, financialAccounts, type FinancialAccount } from '@/lib/db/schema';
import { canReadFinanceRow, type FinanceEntitlements } from '@/lib/services/finance-access';

export async function getAccount(id: string): Promise<FinancialAccount | null> {
  const [account] = await db.select().from(financialAccounts).where(eq(financialAccounts.id, id)).limit(1);
  return account ?? null;
}

export type LatestBalance = {
  balance: string;
  asOfDate: string;
  /** When it was typed in: the plan compares it with when things were ticked off that day. */
  recordedAt: Date;
};

/**
 * Whether a row may point at this account (an income paid into it, a goal saved in it, a bill
 * paid from it): null always may; otherwise the user must be able to see the account.
 */
export async function canUseAccount(accountId: string | null | undefined, userId: string, entitlements: FinanceEntitlements): Promise<boolean> {
  if (!accountId) return true;
  const account = await getAccount(accountId);
  return Boolean(account && !account.archivedAt && canReadFinanceRow(account, userId, entitlements));
}

/** The latest balance of each account: newest as-of date, then newest entry. */
export async function latestBalances(accountIds: string[]): Promise<Map<string, LatestBalance>> {
  const latest = new Map<string, LatestBalance>();
  if (accountIds.length === 0) return latest;
  const rows = await db
    .select()
    .from(accountBalances)
    .where(inArray(accountBalances.accountId, accountIds))
    .orderBy(desc(accountBalances.asOfDate), desc(accountBalances.createdAt));
  for (const row of rows) {
    if (!latest.has(row.accountId)) latest.set(row.accountId, { balance: row.balance, asOfDate: row.asOfDate, recordedAt: row.createdAt });
  }
  return latest;
}
