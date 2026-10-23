import { type NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { savingsGoalContributions, savingsGoals } from '@/lib/db/schema';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { canReadFinanceRow } from '@/lib/services/finance-access';
import { getGoal } from '@/lib/services/goal-service';
import { createContributionSchema, parseBody, readJson } from '@/lib/validation/finance';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/goals/[id]/contributions - Record money put towards a goal. Anyone the goal is shared
// with can. It ticks off the goal's line in that period's plan and adds to what's saved.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: true, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { id } = await params;

  try {
    const goal = await getGoal(id);
    if (!goal || !canReadFinanceRow(goal, user.id, entitlements)) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

    const parsed = parseBody(createContributionSchema, await readJson(req));
    if (parsed instanceof NextResponse) return parsed;

    const contribution = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(savingsGoalContributions)
        .values({ goalId: id, amount: parsed.data.amount, contributedOn: parsed.data.contributedOn, enteredByUserId: user.id })
        .returning();
      await tx
        .update(savingsGoals)
        .set({ savedAmount: sql`${savingsGoals.savedAmount} + ${parsed.data.amount}::numeric`, updatedAt: new Date() })
        .where(eq(savingsGoals.id, id));
      return row;
    });

    submitLogEvent('finance', `Recorded contribution ${contribution.id}`, correlationId, { goalId: id });
    return NextResponse.json(contribution, { status: 201, headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('finance', `Error recording contribution: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to record the contribution' }, { status: 500 });
  }
}
