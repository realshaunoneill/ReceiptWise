import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { householdInvitations } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { HouseholdError, HouseholdService } from '@/lib/services/household-service';
import { and, eq, sql } from 'drizzle-orm';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/invitations/:id — accept or decline from the notifications menu.
 *
 * Matched on the caller's email, which is now always Clerk's verified primary address (it was
 * user-editable, which let anyone claim an invitation meant for someone else). The link flow
 * uses /api/invitations/token/:token instead.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id: invitationId } = await params;
    const { action } = await req.json().catch(() => ({})); // 'accept' or 'decline'

    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json(
        { error: "Invalid action. Must be 'accept' or 'decline'" },
        { status: 400 },
      );
    }

    const [invitation] = UUID_PATTERN.test(invitationId)
      ? await db
        .select()
        .from(householdInvitations)
        .where(
          and(
            eq(householdInvitations.id, invitationId),
            sql`lower(${householdInvitations.invitedEmail}) = ${user.email.toLowerCase()}`,
          ),
        )
        .limit(1)
      : [];

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found or already processed' },
        { status: 404 },
      );
    }

    const result = await HouseholdService.respondToInvitation(invitation, user.id, action);

    return NextResponse.json(
      action === 'accept'
        ? { message: 'Invitation accepted', householdId: result.householdId }
        : { message: 'Invitation declined' },
    );
  } catch (error) {
    if (error instanceof HouseholdError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    submitLogEvent('invitation', `Error processing invitation: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to process invitation' },
      { status: 500 },
    );
  }
}
