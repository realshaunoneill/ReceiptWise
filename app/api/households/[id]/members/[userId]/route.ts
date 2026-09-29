import { type NextRequest, NextResponse } from 'next/server';
import { HouseholdError, HouseholdService } from '@/lib/services/household-service';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
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
 * DELETE /api/households/:id/members/:userId
 * Remove a member from the household
 * Validates: Requirements 3.5
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const requestId = generateRequestId();
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id: householdId, userId: memberUserId } = await params;

    // Remove member (will verify ownership inside the service)
    await HouseholdService.removeMember(householdId, memberUserId, user.id);

    Logger.info('Member removed successfully', {
      requestId,
      userId: user.id,
      context: { householdId, removedUserId: memberUserId },
    });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof HouseholdError) {
      Logger.warn('Member removal refused', {
        requestId,
        context: { error: error.message },
      });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    Logger.error('Error removing member', error as Error, { requestId });
    const errorResponse = createErrorResponse(
      ErrorCode.DATABASE_ERROR,
      'Failed to remove member',
      undefined,
      requestId,
    );
    return NextResponse.json(errorResponse, {
      status: getHttpStatusCode(ErrorCode.DATABASE_ERROR),
    });
  }
}
