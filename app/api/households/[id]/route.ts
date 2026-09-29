import { type NextRequest, NextResponse } from 'next/server';
import { HouseholdError, HouseholdService, validateHouseholdName } from '@/lib/services/household-service';
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
 * GET /api/households/:id
 * Get household details including members
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

    // Get the specific household with membership check (optimized - single query instead of fetching all)
    const household = await HouseholdService.getHouseholdById(householdId, user.id);

    if (!household) {
      Logger.warn('User attempted to access household without permission', {
        requestId,
        userId: user.id,
        context: { householdId },
      });
      const errorResponse = createErrorResponse(
        ErrorCode.FORBIDDEN,
        'Access denied to this household',
        undefined,
        requestId,
      );
      return NextResponse.json(errorResponse, {
        status: getHttpStatusCode(ErrorCode.FORBIDDEN),
      });
    }

    // Get household members
    const members = await HouseholdService.getHouseholdMembers(householdId);

    Logger.info('Household details fetched successfully', {
      requestId,
      userId: user.id,
      context: { householdId, memberCount: members.length },
    });
    return NextResponse.json({
      ...household,
      members,
    }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    Logger.error('Error fetching household', error as Error, { requestId });
    const errorResponse = createErrorResponse(
      ErrorCode.DATABASE_ERROR,
      'Failed to fetch household',
      undefined,
      requestId,
    );
    return NextResponse.json(errorResponse, {
      status: getHttpStatusCode(ErrorCode.DATABASE_ERROR),
    });
  }
}

/**
 * PATCH /api/households/:id
 * Update household name
 * Validates: Requirements 3.4
 */
export async function PATCH(
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

    // Verify user is the owner
    const isOwner = await HouseholdService.isOwner(householdId, user.id);

    if (!isOwner) {
      Logger.warn('Non-owner attempted to update household', {
        requestId,
        userId: user.id,
        context: { householdId },
      });
      const errorResponse = createErrorResponse(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        'Only household owners can update household details',
        undefined,
        requestId,
      );
      return NextResponse.json(errorResponse, {
        status: getHttpStatusCode(ErrorCode.INSUFFICIENT_PERMISSIONS),
      });
    }

    const body = await req.json();

    let name: string;
    try {
      name = validateHouseholdName(body.name);
    } catch (validationError) {
      Logger.warn('Invalid household name provided', {
        requestId,
        userId: user.id,
        context: { householdId },
      });
      const errorResponse = createErrorResponse(
        ErrorCode.INVALID_INPUT,
        validationError instanceof Error ? validationError.message : 'Household name is required',
        { field: 'name' },
        requestId,
      );
      return NextResponse.json(errorResponse, {
        status: getHttpStatusCode(ErrorCode.INVALID_INPUT),
      });
    }

    // Update household name
    const { db } = await import('@/lib/db');
    const { households } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    const [updatedHousehold] = await db
      .update(households)
      .set({ name, updatedAt: new Date() })
      .where(eq(households.id, householdId))
      .returning();

    Logger.info('Household updated successfully', {
      requestId,
      userId: user.id,
      context: { householdId, newName: name },
    });
    return NextResponse.json(updatedHousehold);
  } catch (error) {
    Logger.error('Error updating household', error as Error, { requestId });
    const errorResponse = createErrorResponse(
      ErrorCode.DATABASE_ERROR,
      'Failed to update household',
      undefined,
      requestId,
    );
    return NextResponse.json(errorResponse, {
      status: getHttpStatusCode(ErrorCode.DATABASE_ERROR),
    });
  }
}

/**
 * DELETE /api/households/:id
 * Delete a household (owner only)
 * Validates: Requirements 3.5
 */
export async function DELETE(
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

    // Delete household (will verify ownership inside the service)
    await HouseholdService.deleteHousehold(householdId, user.id);

    Logger.info('Household deleted successfully', {
      requestId,
      userId: user.id,
      context: { householdId },
    });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof HouseholdError) {
      Logger.warn('Household delete refused', {
        requestId,
        context: { error: error.message },
      });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    Logger.error('Error deleting household', error as Error, { requestId });
    const errorResponse = createErrorResponse(
      ErrorCode.DATABASE_ERROR,
      'Failed to delete household',
      undefined,
      requestId,
    );
    return NextResponse.json(errorResponse, {
      status: getHttpStatusCode(ErrorCode.DATABASE_ERROR),
    });
  }
}
