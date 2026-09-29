import { type NextRequest, NextResponse } from 'next/server';
import { HouseholdError, HouseholdService } from '@/lib/services/household-service';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

/**
 * DELETE /api/households/:id/invitations/:invitationId
 * Revoke a pending invitation (owner only). Its link stops working immediately.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; invitationId: string }> },
) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id: householdId, invitationId } = await params;
    await HouseholdService.revokeInvitation(householdId, invitationId, user.id);

    submitLogEvent('invitation', 'Invitation revoked', correlationId, { householdId, invitationId });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof HouseholdError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    submitLogEvent('invitation', `Error revoking invitation: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 });
  }
}
