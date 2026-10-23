import { type NextRequest, NextResponse } from 'next/server';
import { and, asc, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { accountBalances, financialAccounts } from '@/lib/db/schema';
import { submitLogEvent } from '@/lib/logging';
import { clientToday, guardFinanceRoute, PRIVATE_NO_STORE, scopeFromSearchParams } from '@/lib/route-guards';
import { latestBalances } from '@/lib/services/account-service';
import { canFileFinanceRowUnder, financeScopeCondition } from '@/lib/services/finance-access';
import { createAccountSchema, parseBody, readJson } from '@/lib/validation/finance';

export const runtime = 'nodejs';

// GET /api/accounts - Bank accounts with their latest balance (?householdId=; ?archived=true to include archived)
export async function GET(req: NextRequest) {
  const guard = await guardFinanceRoute(req, { mutating: false, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;

  try {
    const { searchParams } = new URL(req.url);
    const condition = financeScopeCondition(financialAccounts, user.id, scopeFromSearchParams(searchParams), entitlements);
    if (!condition) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const rows = await db
      .select()
      .from(financialAccounts)
      .where(searchParams.get('archived') === 'true' ? condition : and(condition, isNull(financialAccounts.archivedAt)))
      .orderBy(asc(financialAccounts.sortOrder), asc(financialAccounts.createdAt));
    const latest = await latestBalances(rows.map((row) => row.id));

    return NextResponse.json(
      rows.map((row) => ({ ...row, latestBalance: latest.get(row.id) ?? null })),
      { headers: PRIVATE_NO_STORE },
    );
  } catch (error) {
    submitLogEvent('finance', `Error listing accounts: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to load accounts' }, { status: 500 });
  }
}

// POST /api/accounts - Add an account, optionally with its balance today
export async function POST(req: NextRequest) {
  const guard = await guardFinanceRoute(req, { mutating: true, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;

  try {
    const parsed = parseBody(createAccountSchema, await readJson(req));
    if (parsed instanceof NextResponse) return parsed;
    const { balance, asOfDate, ...input } = parsed.data;

    const householdId = input.householdId ?? null;
    if (!(await canFileFinanceRowUnder(householdId, user.id, entitlements))) {
      return NextResponse.json({ error: householdId ? 'Not a member of this household' : 'Active subscription required' }, { status: 403 });
    }

    const today = clientToday(new URL(req.url).searchParams.get('today'));
    const created = await db.transaction(async (tx) => {
      const [account] = await tx
        .insert(financialAccounts)
        .values({
          userId: user.id,
          householdId,
          name: input.name,
          kind: input.kind,
          currency: input.currency ?? user.currency ?? 'EUR',
          // A savings account isn't spending money: left out of "left until payday" unless asked.
          includeInPlan: input.includeInPlan ?? input.kind !== 'savings',
          institution: input.institution ?? null,
          last4: input.last4 ?? null,
          sortOrder: input.sortOrder,
        })
        .returning();
      if (balance !== undefined) {
        await tx.insert(accountBalances).values({ accountId: account.id, balance, asOfDate: asOfDate ?? today, enteredByUserId: user.id });
      }
      return account;
    });

    submitLogEvent('finance', `Created account ${created.id}`, correlationId, { accountId: created.id });
    return NextResponse.json(created, { status: 201, headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('finance', `Error creating account: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to add the account' }, { status: 500 });
  }
}
