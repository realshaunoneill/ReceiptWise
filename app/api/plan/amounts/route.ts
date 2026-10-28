import { type NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { planAmounts } from '@/lib/db/schema';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { canOwnFinanceRow } from '@/lib/services/finance-access';
import { getGoal } from '@/lib/services/goal-service';
import { getIncome } from '@/lib/services/income-service';
import { parseBody, readJson, setPlanAmountSchema } from '@/lib/validation/finance';

export const runtime = 'nodejs';

// PUT /api/plan/amounts - One month's pay or savings at a different amount from the usual, or
// back to the usual with amount: null. Only the owner of the pay or the goal can change it, as
// with editing the pay or the goal itself.
export async function PUT(req: NextRequest) {
  const guard = await guardFinanceRoute(req, { mutating: true, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;

  try {
    const parsed = parseBody(setPlanAmountSchema, await readJson(req));
    if (parsed instanceof NextResponse) return parsed;
    const { source, sourceId, day, amount } = parsed.data;

    const row = source === 'income' ? await getIncome(sourceId) : await getGoal(sourceId);
    if (!row || !canOwnFinanceRow(row, user.id, entitlements)) {
      return NextResponse.json({ error: source === 'income' ? 'Income not found' : 'Goal not found' }, { status: 404 });
    }

    const column = source === 'income' ? planAmounts.incomeId : planAmounts.goalId;
    const match = and(eq(column, sourceId), eq(planAmounts.day, day));

    if (amount === null) {
      await db.delete(planAmounts).where(match);
      submitLogEvent('finance', `Reset the ${source} amount for ${day}`, correlationId, { source, sourceId });
      return NextResponse.json({ source, sourceId, day, amount: null }, { headers: PRIVATE_NO_STORE });
    }

    const now = new Date();
    const [saved] = await db
      .insert(planAmounts)
      .values({
        incomeId: source === 'income' ? sourceId : null,
        goalId: source === 'goal' ? sourceId : null,
        day,
        amount,
        setByUserId: user.id,
      })
      .onConflictDoUpdate({ target: [column, planAmounts.day], set: { amount, setByUserId: user.id, updatedAt: now } })
      .returning();

    submitLogEvent('finance', `Set the ${source} amount for ${day}`, correlationId, { source, sourceId });
    return NextResponse.json({ source, sourceId, day: saved.day, amount: saved.amount }, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('finance', `Error setting a plan amount: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to save the amount' }, { status: 500 });
  }
}
