import { type NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { savingsGoalContributions, savingsGoals } from '@/lib/db/schema';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute } from '@/lib/route-guards';
import { canOwnFinanceRow, canReadFinanceRow } from '@/lib/services/finance-access';
import { getGoal } from '@/lib/services/goal-service';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string; contributionId: string }> };

// DELETE /api/goals/[id]/contributions/[contributionId] - Undo a contribution: the goal's owner, or
// whoever recorded it.
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: false, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { id, contributionId } = await params;

  try {
    const goal = await getGoal(id);
    if (!goal || !canReadFinanceRow(goal, user.id, entitlements)) return NextResponse.json({ error: 'Goal not found' }, { status: 404 });

    const [contribution] = await db
      .select()
      .from(savingsGoalContributions)
      .where(and(eq(savingsGoalContributions.id, contributionId), eq(savingsGoalContributions.goalId, id)))
      .limit(1);
    if (!contribution) return NextResponse.json({ error: 'Contribution not found' }, { status: 404 });
    if (contribution.enteredByUserId !== user.id && !canOwnFinanceRow(goal, user.id, entitlements)) {
      return NextResponse.json({ error: 'Only the goal\'s owner or whoever recorded this can undo it' }, { status: 403 });
    }

    await db.transaction(async (tx) => {
      await tx.delete(savingsGoalContributions).where(eq(savingsGoalContributions.id, contributionId));
      await tx
        .update(savingsGoals)
        .set({ savedAmount: sql`greatest(${savingsGoals.savedAmount} - ${contribution.amount}::numeric, 0)`, updatedAt: new Date() })
        .where(eq(savingsGoals.id, id));
    });

    submitLogEvent('finance', `Deleted contribution ${contributionId}`, correlationId, { goalId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    submitLogEvent('finance', `Error deleting contribution: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to undo the contribution' }, { status: 500 });
  }
}
