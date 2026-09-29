import { type NextRequest, NextResponse } from 'next/server';
import { buildInviteUrl, HouseholdError, HouseholdService } from '@/lib/services/household-service';
import {
  getAuthenticatedUser,
  requireHouseholdMembership,
  requireNoPendingDeletion,
  requireSubscription,
} from '@/lib/auth-helpers';
import {
  createErrorResponse,
  ErrorCode,
  generateRequestId,
  getHttpStatusCode,
  Logger,
} from '@/lib/errors';
import { randomUUID } from 'crypto';
import { type CorrelationId } from '@/lib/logging';

/**
 * GET /api/households/:id/members
 * Get all members of a household
 * Validates: Requirements 3.4
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id: householdId } = await params;

    // Verify user is a member of this household before showing members list
    const membershipCheck = await requireHouseholdMembership(householdId, user.id, correlationId);
    if (membershipCheck) return membershipCheck;

    // Get household members
    const members = await HouseholdService.getHouseholdMembers(householdId);

    Logger.info('Household members fetched successfully', {
      requestId,
      userId: user.id,
      context: { householdId, memberCount: members.length },
    });
    return NextResponse.json(members, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    Logger.error('Error fetching household members', error as Error, { requestId });
    const errorResponse = createErrorResponse(
      ErrorCode.DATABASE_ERROR,
      'Failed to fetch household members',
      undefined,
      requestId,
    );
    return NextResponse.json(errorResponse, {
      status: getHttpStatusCode(ErrorCode.DATABASE_ERROR),
    });
  }
}

/**
 * POST /api/households/:id/members
 * Invite someone to the household (owner only). Same behaviour as
 * POST /api/households/:id/invitations, kept for existing callers.
 * Validates: Requirements 3.3
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const subscriptionCheck = await requireSubscription(user);
    if (subscriptionCheck) return subscriptionCheck;
    const deletionCheck = requireNoPendingDeletion(user);
    if (deletionCheck) return deletionCheck;

    const { id: householdId } = await params;
    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email : '';

    const invitation = await HouseholdService.createInvitation(householdId, email, user.id);

    Logger.info('Member invited successfully', {
      requestId,
      userId: user.id,
      context: { householdId, invitationId: invitation.id },
    });
    return NextResponse.json({
      id: invitation.id,
      invitedEmail: invitation.invitedEmail,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      inviteUrl: buildInviteUrl(invitation.token),
    }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    // Expected refusals (not the owner, already a member, already invited, bad email) are the
    // caller's to fix, so they get their own status rather than a 500.
    if (error instanceof HouseholdError) {
      Logger.warn('Invitation refused', {
        requestId,
        context: { error: error.message },
      });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    Logger.error('Error inviting member', error as Error, { requestId });
    const errorResponse = createErrorResponse(
      ErrorCode.DATABASE_ERROR,
      'Failed to invite member',
      undefined,
      requestId,
    );
    return NextResponse.json(errorResponse, {
      status: getHttpStatusCode(ErrorCode.DATABASE_ERROR),
    });
  }
}
