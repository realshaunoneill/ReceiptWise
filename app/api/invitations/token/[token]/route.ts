import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { householdInvitations } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { HouseholdError, HouseholdService } from '@/lib/services/household-service';
import { eq } from 'drizzle-orm';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

/**
 * GET /api/invitations/token/:token: what the invitation link's page shows, for the app: the
 * household, who invited, and whether it's still open. Holding the link is what lets you see it,
 * as on the website's /invite page, so no sign-in is needed. The invited address isn't shared.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await HouseholdService.getInvitationByToken(token);
  if (!invitation) return NextResponse.json({ error: "This link isn't valid" }, { status: 404 });
  return NextResponse.json(
    {
      householdName: invitation.householdName,
      invitedByEmail: invitation.invitedByEmail,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

/**
 * POST /api/invitations/token/:token — accept or decline an invitation from its link.
 *
 * Holding the link is the authorisation: the owner chose who to send it to, and the invited
 * person may well sign up with a different address than the one typed into the invite. The
 * token is 32 random bytes, single-use, expires after 7 days and can be revoked by the owner.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { token } = await params;
    const { action } = await req.json().catch(() => ({}));

    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json(
        { error: "Invalid action. Must be 'accept' or 'decline'" },
        { status: 400 },
      );
    }

    const [invitation] = /^[a-f0-9]{64}$/.test(token)
      ? await db
        .select()
        .from(householdInvitations)
        .where(eq(householdInvitations.token, token))
        .limit(1)
      : [];

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    const result = await HouseholdService.respondToInvitation(invitation, user.id, action);

    submitLogEvent('invitation', `Invitation ${action === 'accept' ? 'accepted' : 'declined'} via link`, correlationId, {
      invitationId: invitation.id,
      householdId: invitation.householdId,
      userId: user.id,
    });

    return NextResponse.json({
      householdId: result.householdId,
      alreadyMember: result.alreadyMember,
    });
  } catch (error) {
    if (error instanceof HouseholdError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    submitLogEvent('invitation', `Error processing invitation link: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to process invitation' }, { status: 500 });
  }
}
