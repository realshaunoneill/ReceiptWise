import { type NextRequest, NextResponse } from 'next/server';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db';
import { households, householdInvitations, users } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { and, eq, gt, sql } from 'drizzle-orm';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

const inviter = alias(users, 'inviter');

// Get the caller's pending invitations, matched on their verified (lower-cased) email.
export async function GET(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const invitations = await db
      .select({
        id: householdInvitations.id,
        householdId: householdInvitations.householdId,
        householdName: households.name,
        // Was householdInvitations.invitedEmail — i.e. the invitee's own address, shown back to
        // them as "invited by".
        invitedByEmail: inviter.email,
        status: householdInvitations.status,
        createdAt: householdInvitations.createdAt,
        expiresAt: householdInvitations.expiresAt,
      })
      .from(householdInvitations)
      .leftJoin(households, eq(householdInvitations.householdId, households.id))
      .leftJoin(inviter, eq(householdInvitations.invitedByUserId, inviter.id))
      .where(
        and(
          sql`lower(${householdInvitations.invitedEmail}) = ${user.email.toLowerCase()}`,
          eq(householdInvitations.status, 'pending'),
          gt(householdInvitations.expiresAt, new Date()),
        ),
      );

    return NextResponse.json(invitations, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    submitLogEvent('invitation', `Error fetching invitations: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 },
    );
  }
}
