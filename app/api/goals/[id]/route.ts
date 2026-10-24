import { type NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { savingsGoals } from '@/lib/db/schema';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { canFileFinanceRowUnder, canOwnFinanceRow, canReadFinanceRow } from '@/lib/services/finance-access';
import { canUseAccount } from '@/lib/services/account-service';
import { getGoal } from '@/lib/services/goal-service';
import { parseBody, readJson, updateGoalSchema } from '@/lib/validation/finance';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

const NOT_FOUND = { error: 'Goal not found' };

// PATCH /api/goals/[id] - Change a goal (its owner only)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: true, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { id } = await params;

  try {
    const existing = await getGoal(id);
    if (!existing || !canReadFinanceRow(existing, user.id, entitlements)) return NextResponse.json(NOT_FOUND, { status: 404 });
    if (!canOwnFinanceRow(existing, user.id, entitlements)) {
      return NextResponse.json({ error: 'Only the person who added this can change it' }, { status: 403 });
    }

    const parsed = parseBody(updateGoalSchema, await readJson(req));
    if (parsed instanceof NextResponse) return parsed;
    const input = parsed.data;
    if (input.householdId !== undefined && input.householdId !== existing.householdId
      && !(await canFileFinanceRowUnder(input.householdId ?? null, user.id, entitlements))) {
      return NextResponse.json({ error: input.householdId ? 'Not a member of this household' : 'Active subscription required' }, { status: 403 });
    }
    if (input.linkedAccountId !== undefined && input.linkedAccountId !== existing.linkedAccountId
      && !(await canUseAccount(input.linkedAccountId, user.id, entitlements))) {
      return NextResponse.json({ error: 'linkedAccountId is not one of your accounts' }, { status: 400 });
    }

    const [updated] = await db
      .update(savingsGoals)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(savingsGoals.id, id))
      .returning();

    submitLogEvent('finance', `Updated goal ${id}`, correlationId, { goalId: id });
    return NextResponse.json(updated, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('finance', `Error updating goal: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to update the goal' }, { status: 500 });
  }
}

// DELETE /api/goals/[id] - Delete a goal and its contributions (its owner only)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: false, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { id } = await params;

  try {
    const existing = await getGoal(id);
    if (!existing || !canReadFinanceRow(existing, user.id, entitlements)) return NextResponse.json(NOT_FOUND, { status: 404 });
    if (!canOwnFinanceRow(existing, user.id, entitlements)) {
      return NextResponse.json({ error: 'Only the person who added this can delete it' }, { status: 403 });
    }

    await db.delete(savingsGoals).where(eq(savingsGoals.id, id));
    submitLogEvent('finance', `Deleted goal ${id}`, correlationId, { goalId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    submitLogEvent('finance', `Error deleting goal: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to delete the goal' }, { status: 500 });
  }
}
