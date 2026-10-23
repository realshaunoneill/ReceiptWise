import { type NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { incomeSources } from '@/lib/db/schema';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { canFileFinanceRowUnder, canOwnFinanceRow } from '@/lib/services/finance-access';
import { clearOtherPrimaries, getIncome } from '@/lib/services/income-service';
import { parseBody, readJson, updateIncomeSchema } from '@/lib/validation/finance';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

const NOT_FOUND = { error: 'Income not found' };

// PATCH /api/income/[id] - Change an income (its owner only)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: true, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { id } = await params;

  try {
    const existing = await getIncome(id);
    if (!existing || !canOwnFinanceRow(existing, user.id, entitlements)) return NextResponse.json(NOT_FOUND, { status: 404 });

    const parsed = parseBody(updateIncomeSchema, await readJson(req));
    if (parsed instanceof NextResponse) return parsed;
    const input = parsed.data;

    if (input.householdId !== undefined && input.householdId !== existing.householdId
      && !(await canFileFinanceRowUnder(input.householdId ?? null, user.id, entitlements))) {
      return NextResponse.json({ error: input.householdId ? 'Not a member of this household' : 'Active subscription required' }, { status: 403 });
    }

    const frequency = input.frequency ?? existing.frequency;
    const payDay = input.payDay !== undefined ? input.payDay : existing.payDay;
    const anchorDate = input.anchorDate !== undefined ? input.anchorDate : existing.anchorDate;
    if (frequency === 'monthly' && !payDay) {
      return NextResponse.json({ error: 'payDay is required for monthly pay' }, { status: 400 });
    }
    if (['weekly', 'fortnightly', 'four_weekly'].includes(frequency) && !anchorDate) {
      return NextResponse.json({ error: 'anchorDate is required: any date you were paid' }, { status: 400 });
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(incomeSources)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(incomeSources.id, id))
        .returning();
      if (row.isPrimary && row.status === 'active') await clearOtherPrimaries(tx, row.userId, row.id);
      return row;
    });

    submitLogEvent('finance', `Updated income ${id}`, correlationId, { incomeId: id });
    return NextResponse.json(updated, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('finance', `Error updating income: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to update income' }, { status: 500 });
  }
}

// DELETE /api/income/[id] - Remove an income (its owner only)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: false, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { id } = await params;

  try {
    const existing = await getIncome(id);
    if (!existing || !canOwnFinanceRow(existing, user.id, entitlements)) return NextResponse.json(NOT_FOUND, { status: 404 });

    await db.delete(incomeSources).where(eq(incomeSources.id, id));
    submitLogEvent('finance', `Deleted income ${id}`, correlationId, { incomeId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    submitLogEvent('finance', `Error deleting income: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to delete income' }, { status: 500 });
  }
}
