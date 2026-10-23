import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accountBalances, financialAccounts, type FinancialAccount } from '@/lib/db/schema';

export async function getAccount(id: string): Promise<FinancialAccount | null> {
  const [account] = await db.select().from(financialAccounts).where(eq(financialAccounts.id, id)).limit(1);
  return account ?? null;
}

/** The latest balance of each account: newest as-of date, then newest entry. */
export async function latestBalances(accountIds: string[]): Promise<Map<string, { balance: string; asOfDate: string }>> {
  const latest = new Map<string, { balance: string; asOfDate: string }>();
  if (accountIds.length === 0) return latest;
  const rows = await db
    .select()
    .from(accountBalances)
    .where(inArray(accountBalances.accountId, accountIds))
    .orderBy(desc(accountBalances.asOfDate), desc(accountBalances.createdAt));
  for (const row of rows) {
    if (!latest.has(row.accountId)) latest.set(row.accountId, { balance: row.balance, asOfDate: row.asOfDate });
  }
  return latest;
}
