import { type NextRequest, NextResponse } from 'next/server';
import { and, inArray, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accountBalances, financialAccounts } from '@/lib/db/schema';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { canReadFinanceRow } from '@/lib/services/finance-access';
import { parseBody, readJson, recordBalancesSchema } from '@/lib/validation/finance';

export const runtime = 'nodejs';

// POST /api/accounts/balances - Record balances, several accounts at once (the "update my
// balances" check-in). Anyone an account is shared with can.
export async function POST(req: NextRequest) {
  const guard = await guardFinanceRoute(req, { mutating: true, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;

  try {
    const parsed = parseBody(recordBalancesSchema, await readJson(req));
    if (parsed instanceof NextResponse) return parsed;
    const { balances } = parsed.data;

    const accountIds = [...new Set(balances.map((entry) => entry.accountId))];
    const accounts = await db
      .select()
      .from(financialAccounts)
      .where(and(inArray(financialAccounts.id, accountIds), isNull(financialAccounts.archivedAt)));
    const allowed = new Set(accounts.filter((account) => canReadFinanceRow(account, user.id, entitlements)).map((account) => account.id));
    if (accountIds.some((id) => !allowed.has(id))) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const created = await db
      .insert(accountBalances)
      .values(balances.map((entry) => ({ ...entry, enteredByUserId: user.id })))
      .returning();

    submitLogEvent('finance', `Recorded ${created.length} balance(s)`, correlationId, { count: created.length });
    return NextResponse.json(created, { status: 201, headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('finance', `Error recording balances: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to record balances' }, { status: 500 });
  }
}
