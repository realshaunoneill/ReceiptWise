import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { households } from '@/lib/db/schema';
import { buildInviteUrl, HouseholdError, HouseholdService } from '@/lib/services/household-service';
import {
  getAuthenticatedUser,
  getHouseholdMembership,
  requireNoPendingDeletion,
  requireSubscription,
} from '@/lib/auth-helpers';
import { eq } from 'drizzle-orm';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * POST /api/households/:id/invitations
 *
 * Create an invitation (owner only) and return its shareable link. There is no email
 * provider, so the owner sends the link themselves; someone who already has an account on the
 * invited address also sees it in their notifications.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // Household management is part of Premium; the UI already hid Invite from
    // non-subscribers, this makes the rule hold server-side too.
    const subscriptionCheck = await requireSubscription(user);
    if (subscriptionCheck) return subscriptionCheck;
    const deletionCheck = requireNoPendingDeletion(user);
    if (deletionCheck) return deletionCheck;

    const { id: householdId } = await params;
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email : '';

    const invitation = await HouseholdService.createInvitation(householdId, email, user.id);

    const [household] = await db
      .select({ name: households.name })
      .from(households)
      .where(eq(households.id, householdId))
      .limit(1);

    submitLogEvent('invitation', 'Invitation created', correlationId, {
      householdId,
      invitationId: invitation.id,
    });

    return NextResponse.json({
      id: invitation.id,
      householdName: household?.name,
      invitedEmail: invitation.invitedEmail,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      inviteUrl: buildInviteUrl(invitation.token),
    }, { status: 201, headers: NO_STORE });
  } catch (error) {
    if (error instanceof HouseholdError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    submitLogEvent('invitation', `Error creating invitation: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/households/:id/invitations
 *
 * Pending, unexpired invitations for a household (members only). Only the owner gets the
 * invite links — a link is the authorisation to join, so members don't get to hand them out.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id: householdId } = await params;

    const membership = await getHouseholdMembership(householdId, user.id);
    if (!membership) {
      return NextResponse.json(
        { error: 'Not authorized to view invitations' },
        { status: 403 },
      );
    }

    const isOwner = membership.role === 'owner';
    const invitations = await HouseholdService.getPendingInvitations(householdId);

    return NextResponse.json(
      invitations.map(({ token, ...invitation }) => ({
        ...invitation,
        ...(isOwner && { inviteUrl: buildInviteUrl(token) }),
      })),
      { headers: NO_STORE },
    );
  } catch (error) {
    submitLogEvent('invitation', `Error fetching invitations: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 },
    );
  }
}
