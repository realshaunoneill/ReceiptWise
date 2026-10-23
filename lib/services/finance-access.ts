import { and, eq, exists, inArray, sql, type SQL } from 'drizzle-orm';
import { alias, type PgColumn } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db';
import { householdUsers, users, type User } from '@/lib/db/schema';

/**
 * Who can see and change finance rows: tracked subscriptions and bills now, and accounts,
 * income and goals as they arrive.
 *
 * Every finance row has an owner (userId) and may be shared with one household (householdId),
 * the same shape as receipts. The rules:
 *   - Personal data needs your own Premium.
 *   - Data shared with a household is usable by every member when ANY member of that household
 *     is subscribed (one Premium covers the household's shared data). Receipts keep their own,
 *     older gating; this applies to finance rows only.
 *   - Only the owner edits, re-shares or deletes a row. Members of a shared row can do the
 *     day-to-day things: mark an occurrence paid or skipped, set its amount, add a balance.
 *   - Admins get no special access. Finance data stays out of /admin.
 */

export type FinanceScope = { type: 'mine' } | { type: 'household'; householdId: string };

export type FinanceEntitlements = {
  /** Your own Premium (or SKIP_SUBSCRIPTION_CHECK). */
  personal: boolean;
  /** Households you belong to in which some member is subscribed. */
  householdIds: string[];
};

type OwnedRow = { userId: string; householdId: string | null };

function skipSubscriptionCheck(): boolean {
  return process.env.SKIP_SUBSCRIPTION_CHECK === 'true';
}

/** Households the user belongs to where at least one member is subscribed. */
export async function entitledHouseholdIds(userId: string): Promise<string[]> {
  if (skipSubscriptionCheck()) {
    const memberships = await db
      .select({ householdId: householdUsers.householdId })
      .from(householdUsers)
      .where(eq(householdUsers.userId, userId));
    return memberships.map((row) => row.householdId);
  }

  const fellowMember = alias(householdUsers, 'fellow_member');
  const rows = await db
    .selectDistinct({ householdId: householdUsers.householdId })
    .from(householdUsers)
    .innerJoin(fellowMember, eq(fellowMember.householdId, householdUsers.householdId))
    .innerJoin(users, eq(users.id, fellowMember.userId))
    .where(and(eq(householdUsers.userId, userId), eq(users.subscribed, true)));
  return rows.map((row) => row.householdId);
}

export async function getFinanceEntitlements(user: User): Promise<FinanceEntitlements> {
  const personal = skipSubscriptionCheck() || Boolean(user.subscribed);
  return { personal, householdIds: await entitledHouseholdIds(user.id) };
}

export function hasAnyFinanceAccess(entitlements: FinanceEntitlements): boolean {
  return entitlements.personal || entitlements.householdIds.length > 0;
}

/** Can the user see this row (and act on its occurrences)? */
export function canReadFinanceRow(row: OwnedRow, userId: string, entitlements: FinanceEntitlements): boolean {
  if (row.userId === userId && entitlements.personal) return true;
  return row.householdId !== null && entitlements.householdIds.includes(row.householdId);
}

/** Can the user edit, re-share or delete this row? Owner only, and only while they can still see it. */
export function canOwnFinanceRow(row: OwnedRow, userId: string, entitlements: FinanceEntitlements): boolean {
  return row.userId === userId && canReadFinanceRow(row, userId, entitlements);
}

/**
 * Can the user create (or move) a row into this household, or keep it personal (null)?
 * A household needs membership plus the household being covered, or the user's own Premium.
 */
export async function canFileFinanceRowUnder(
  householdId: string | null,
  userId: string,
  entitlements: FinanceEntitlements,
): Promise<boolean> {
  if (householdId === null) return entitlements.personal;
  if (entitlements.householdIds.includes(householdId)) return true;
  if (!entitlements.personal) return false;
  const [membership] = await db
    .select({ id: householdUsers.id })
    .from(householdUsers)
    .where(and(eq(householdUsers.householdId, householdId), eq(householdUsers.userId, userId)))
    .limit(1);
  return Boolean(membership);
}

/**
 * The WHERE condition for listing a finance table in a scope, or null when the user may not
 * see that scope at all.
 *
 * 'mine' is the rows you own: all of them with your own Premium, otherwise only those shared
 * with a covered household. 'household' is every member's rows shared with that household. Its
 * membership EXISTS is defence in depth, as in lib/receipt-scanner.ts, so the condition is never
 * householdId alone.
 */
export function financeScopeCondition(
  table: { userId: PgColumn; householdId: PgColumn },
  userId: string,
  scope: FinanceScope,
  entitlements: FinanceEntitlements,
): SQL | null {
  if (scope.type === 'mine') {
    if (entitlements.personal) return eq(table.userId, userId);
    if (entitlements.householdIds.length === 0) return null;
    return and(eq(table.userId, userId), inArray(table.householdId, entitlements.householdIds)) ?? null;
  }

  if (!entitlements.householdIds.includes(scope.householdId)) return null;
  return and(
    eq(table.householdId, scope.householdId),
    exists(
      db
        .select({ one: sql`1` })
        .from(householdUsers)
        .where(and(eq(householdUsers.householdId, scope.householdId), eq(householdUsers.userId, userId))),
    ),
  ) ?? null;
}
