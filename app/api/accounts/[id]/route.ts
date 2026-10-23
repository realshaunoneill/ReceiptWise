import { type NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { financialAccounts } from '@/lib/db/schema';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { getAccount } from '@/lib/services/account-service';
import { canFileFinanceRowUnder, canOwnFinanceRow, canReadFinanceRow } from '@/lib/services/finance-access';
import { parseBody, readJson, updateAccountSchema } from '@/lib/validation/finance';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

const NOT_FOUND = { error: 'Account not found' };

// PATCH /api/accounts/[id] - Change an account (its owner only)
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: true, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { id } = await params;

  try {
    const existing = await getAccount(id);
    if (!existing || !canReadFinanceRow(existing, user.id, entitlements)) return NextResponse.json(NOT_FOUND, { status: 404 });
    if (!canOwnFinanceRow(existing, user.id, entitlements)) {
      return NextResponse.json({ error: 'Only the person who added this can change it' }, { status: 403 });
    }

    const parsed = parseBody(updateAccountSchema, await readJson(req));
    if (parsed instanceof NextResponse) return parsed;
    const input = parsed.data;
    if (input.householdId !== undefined && input.householdId !== existing.householdId
      && !(await canFileFinanceRowUnder(input.householdId ?? null, user.id, entitlements))) {
      return NextResponse.json({ error: input.householdId ? 'Not a member of this household' : 'Active subscription required' }, { status: 403 });
    }

    const [updated] = await db
      .update(financialAccounts)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(financialAccounts.id, id))
      .returning();

    submitLogEvent('finance', `Updated account ${id}`, correlationId, { accountId: id });
    return NextResponse.json(updated, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('finance', `Error updating account: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to update the account' }, { status: 500 });
  }
}

// DELETE /api/accounts/[id] - Archive an account, or with ?hard=true delete it and its balance
// history (its owner only)
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: false, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;
  const { id } = await params;

  try {
    const existing = await getAccount(id);
    if (!existing || !canReadFinanceRow(existing, user.id, entitlements)) return NextResponse.json(NOT_FOUND, { status: 404 });
    if (!canOwnFinanceRow(existing, user.id, entitlements)) {
      return NextResponse.json({ error: 'Only the person who added this can delete it' }, { status: 403 });
    }

    if (new URL(req.url).searchParams.get('hard') === 'true') {
      await db.delete(financialAccounts).where(eq(financialAccounts.id, id));
    } else {
      await db.update(financialAccounts).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(financialAccounts.id, id));
    }

    submitLogEvent('finance', `Removed account ${id}`, correlationId, { accountId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    submitLogEvent('finance', `Error removing account: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to remove the account' }, { status: 500 });
  }
}
