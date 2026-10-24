import { type NextRequest, NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { savingsGoals } from '@/lib/db/schema';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE, scopeFromSearchParams } from '@/lib/route-guards';
import { canUseAccount } from '@/lib/services/account-service';
import { canFileFinanceRowUnder, financeScopeCondition } from '@/lib/services/finance-access';
import { createGoalSchema, parseBody, readJson } from '@/lib/validation/finance';

export const runtime = 'nodejs';

// GET /api/goals - Savings goals (?householdId= for a household's shared ones)
export async function GET(req: NextRequest) {
  const guard = await guardFinanceRoute(req, { mutating: false, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;

  try {
    const condition = financeScopeCondition(savingsGoals, user.id, scopeFromSearchParams(new URL(req.url).searchParams), entitlements);
    if (!condition) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    const rows = await db.select().from(savingsGoals).where(condition).orderBy(asc(savingsGoals.createdAt));
    return NextResponse.json(rows, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('finance', `Error listing goals: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to load goals' }, { status: 500 });
  }
}

// POST /api/goals - Add a goal. Its contribution per period appears as a line in the plan.
export async function POST(req: NextRequest) {
  const guard = await guardFinanceRoute(req, { mutating: true, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;

  try {
    const parsed = parseBody(createGoalSchema, await readJson(req));
    if (parsed instanceof NextResponse) return parsed;
    const input = parsed.data;

    const householdId = input.householdId ?? null;
    if (!(await canFileFinanceRowUnder(householdId, user.id, entitlements))) {
      return NextResponse.json({ error: householdId ? 'Not a member of this household' : 'Active subscription required' }, { status: 403 });
    }
    if (!(await canUseAccount(input.linkedAccountId, user.id, entitlements))) {
      return NextResponse.json({ error: 'linkedAccountId is not one of your accounts' }, { status: 400 });
    }

    const [created] = await db
      .insert(savingsGoals)
      .values({
        userId: user.id,
        householdId,
        name: input.name,
        targetAmount: input.targetAmount ?? null,
        currency: input.currency ?? user.currency ?? 'EUR',
        targetDate: input.targetDate ?? null,
        contributionPerCycle: input.contributionPerCycle ?? null,
        savedAmount: input.savedAmount,
        linkedAccountId: input.linkedAccountId ?? null,
        status: input.status,
      })
      .returning();

    submitLogEvent('finance', `Created goal ${created.id}`, correlationId, { goalId: created.id });
    return NextResponse.json(created, { status: 201, headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('finance', `Error creating goal: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to add the goal' }, { status: 500 });
  }
}
