import { type NextRequest, NextResponse } from 'next/server';
import { and, asc, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { incomeSources } from '@/lib/db/schema';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE, scopeFromSearchParams } from '@/lib/route-guards';
import { canFileFinanceRowUnder, financeScopeCondition } from '@/lib/services/finance-access';
import { clearOtherPrimaries } from '@/lib/services/income-service';
import { createIncomeSchema, parseBody, readJson } from '@/lib/validation/finance';

export const runtime = 'nodejs';

// GET /api/income - Income sources (?householdId= for a household's shared ones)
export async function GET(req: NextRequest) {
  const guard = await guardFinanceRoute(req, { mutating: false, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;

  try {
    const scope = scopeFromSearchParams(new URL(req.url).searchParams);
    const condition = financeScopeCondition(incomeSources, user.id, scope, entitlements);
    if (!condition) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const rows = await db
      .select()
      .from(incomeSources)
      .where(and(condition))
      .orderBy(desc(incomeSources.isPrimary), asc(incomeSources.createdAt));
    return NextResponse.json(rows, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('finance', `Error listing income: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to load income' }, { status: 500 });
  }
}

// POST /api/income - Add an income. The first one, or one marked primary, sets the plan's period.
export async function POST(req: NextRequest) {
  const guard = await guardFinanceRoute(req, { mutating: true, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;

  try {
    const parsed = parseBody(createIncomeSchema, await readJson(req));
    if (parsed instanceof NextResponse) return parsed;
    const input = parsed.data;

    const householdId = input.householdId ?? null;
    if (!(await canFileFinanceRowUnder(householdId, user.id, entitlements))) {
      return NextResponse.json({ error: householdId ? 'Not a member of this household' : 'Active subscription required' }, { status: 403 });
    }

    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(incomeSources)
        .values({
          userId: user.id,
          householdId,
          name: input.name,
          amount: input.amount,
          currency: input.currency,
          frequency: input.frequency,
          payDay: input.frequency === 'monthly' ? input.payDay ?? null : null,
          anchorDate: input.anchorDate ?? null,
          weekendRule: input.weekendRule,
          isPrimary: input.isPrimary,
          intoAccountId: input.intoAccountId ?? null,
          status: input.status,
          endDate: input.endDate ?? null,
        })
        .returning();
      if (row.isPrimary) await clearOtherPrimaries(tx, user.id, row.id);
      return row;
    });

    submitLogEvent('finance', `Created income ${created.id}`, correlationId, { incomeId: created.id });
    return NextResponse.json(created, { status: 201, headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('finance', `Error creating income: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to add income' }, { status: 500 });
  }
}
