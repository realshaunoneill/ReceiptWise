import { type NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { planEntries } from '@/lib/db/schema';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { canFileFinanceRowUnder, canOwnFinanceRow, canReadFinanceRow } from '@/lib/services/finance-access';
import { parseBody, readJson, updateEntrySchema } from '@/lib/validation/finance';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

const NOT_FOUND = { error: 'Not found' };

async function getEntry(id: string) {
  const [entry] = await db.select().from(planEntries).where(eq(planEntries.id, id)).limit(1);
  return entry ?? null;
}

// PATCH /api/plan/entries/[id] - Change a one-off line. Its owner can change anything; anyone it is
// shared with can only tick it done or not.
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: true, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { id } = await params;

  try {
    const existing = await getEntry(id);
    if (!existing || !canReadFinanceRow(existing, user.id, entitlements)) return NextResponse.json(NOT_FOUND, { status: 404 });

    const parsed = parseBody(updateEntrySchema, await readJson(req));
    if (parsed instanceof NextResponse) return parsed;
    const { done, ...input } = parsed.data;

    const owner = canOwnFinanceRow(existing, user.id, entitlements);
    if (!owner && Object.keys(input).length > 0) {
      return NextResponse.json({ error: 'Only the person who added this can change it' }, { status: 403 });
    }
    if (input.householdId !== undefined && input.householdId !== existing.householdId
      && !(await canFileFinanceRowUnder(input.householdId ?? null, user.id, entitlements))) {
      return NextResponse.json({ error: input.householdId ? 'Not a member of this household' : 'Active subscription required' }, { status: 403 });
    }

    const [updated] = await db
      .update(planEntries)
      .set({
        ...input,
        ...(done === undefined ? {} : { doneAt: done ? existing.doneAt ?? new Date() : null }),
        updatedAt: new Date(),
      })
      .where(eq(planEntries.id, id))
      .returning();

    submitLogEvent('finance', `Updated plan entry ${id}`, correlationId, { entryId: id });
    return NextResponse.json(updated, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('finance', `Error updating plan entry: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

// DELETE /api/plan/entries/[id] - Remove a one-off line (its owner only)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: false, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { id } = await params;

  try {
    const existing = await getEntry(id);
    if (!existing || !canReadFinanceRow(existing, user.id, entitlements)) return NextResponse.json(NOT_FOUND, { status: 404 });
    if (!canOwnFinanceRow(existing, user.id, entitlements)) {
      return NextResponse.json({ error: 'Only the person who added this can delete it' }, { status: 403 });
    }

    await db.delete(planEntries).where(eq(planEntries.id, id));
    submitLogEvent('finance', `Deleted plan entry ${id}`, correlationId, { entryId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    submitLogEvent('finance', `Error deleting plan entry: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
