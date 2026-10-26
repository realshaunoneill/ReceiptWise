import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { count, eq, type SQL } from 'drizzle-orm';
import { type PgTable } from 'drizzle-orm/pg-core';
import { discardRefusal } from '@/lib/account-discard';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import {
  apiKeys,
  authAccount,
  authUser,
  billDocuments,
  financialAccounts,
  householdInvitations,
  householdUsers,
  inboundEmails,
  incomeSources,
  planEntries,
  premiumGrants,
  receipts,
  savingsGoals,
  subscriptions,
  users,
} from '@/lib/db/schema';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';

export const runtime = 'nodejs';

/**
 * Throw away the signed-in account if it was made by mistake: the app's answer to "I already have
 * an account" after a first Sign in with Apple that hid the email (rules in lib/account-discard.ts).
 * Deletes the account and its sign-in; the app then signs in with Google. Refuses, with the reason,
 * for any account something could be lost from.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  const authResult = await getAuthenticatedUser(correlationId);
  if (authResult instanceof NextResponse) return authResult;
  const { user, authUserId } = authResult;

  // Everything the account could own. Insights cache and the forwarding address are made on their
  // own and hold nothing of the user's, so they don't count (they go with the account).
  const owned: Array<[PgTable, SQL]> = [
    [receipts, eq(receipts.userId, user.id)],
    [subscriptions, eq(subscriptions.userId, user.id)],
    [planEntries, eq(planEntries.userId, user.id)],
    [incomeSources, eq(incomeSources.userId, user.id)],
    [savingsGoals, eq(savingsGoals.userId, user.id)],
    [financialAccounts, eq(financialAccounts.userId, user.id)],
    [billDocuments, eq(billDocuments.userId, user.id)],
    [householdUsers, eq(householdUsers.userId, user.id)],
    [householdInvitations, eq(householdInvitations.invitedByUserId, user.id)],
    [premiumGrants, eq(premiumGrants.userId, user.id)],
    [apiKeys, eq(apiKeys.userId, user.id)],
    [inboundEmails, eq(inboundEmails.userId, user.id)],
  ];
  const [counts, [methods]] = await Promise.all([
    Promise.all(owned.map(([table, where]) => db.select({ n: count() }).from(table).where(where))),
    db.select({ n: count() }).from(authAccount).where(eq(authAccount.userId, authUserId)),
  ]);

  const refusal = discardRefusal({
    createdAt: user.createdAt,
    stripeCustomerId: user.stripeCustomerId,
    signInMethods: methods.n,
    ownedRows: counts.reduce((sum, [row]) => sum + row.n, 0),
  }, new Date());
  if (refusal) return NextResponse.json({ error: refusal }, { status: 409 });

  // The app's row first (its auth link is set-null), then the auth user, whose sessions and
  // sign-in method go with it.
  await db.transaction(async (tx) => {
    await tx.delete(users).where(eq(users.id, user.id));
    await tx.delete(authUser).where(eq(authUser.id, authUserId));
  });
  submitLogEvent('user', 'Discarded a new empty account', correlationId, { userId: user.id });
  return NextResponse.json({ discarded: true }, { headers: { 'Cache-Control': 'private, no-store' } });
}
