import { type NextRequest, NextResponse } from 'next/server';
import { HouseholdError, HouseholdService } from '@/lib/services/household-service';
import { getAuthenticatedUser, requireNoPendingDeletion, requireSubscription } from '@/lib/auth-helpers';
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
 * GET /api/households
 * List all households the current user belongs to
 * Validates: Requirements 3.6
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const correlationId = (request.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const authResult = await getAuthenticatedUser(correlationId);

    if (authResult instanceof NextResponse) {
      Logger.warn('Unauthenticated request to GET /api/households', { requestId });
      return authResult;
    }

    const { user } = authResult;

    // Get all households for the user
    const households = await HouseholdService.getHouseholdsByUser(user.id);

    Logger.info('Households fetched successfully', {
      requestId,
      userId: user.id,
      context: { count: households.length },
    });
    return NextResponse.json(households, {
      headers: {
        // Not cached: after creating a household or accepting an invite the client refetches,
        // and a cached copy kept the new household out of view for up to five minutes.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    Logger.error('Error fetching households', error as Error, { requestId });
    const errorResponse = createErrorResponse(
      ErrorCode.DATABASE_ERROR,
      'Failed to fetch households',
      undefined,
      requestId,
    );
    return NextResponse.json(errorResponse, {
      status: getHttpStatusCode(ErrorCode.DATABASE_ERROR),
    });
  }
}

/**
 * POST /api/households
 * Create a new household
 * Validates: Requirements 3.1, 3.2
 */
export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const authResult = await getAuthenticatedUser(correlationId);

    if (authResult instanceof NextResponse) {
      Logger.warn('Unauthenticated request to POST /api/households', { requestId });
      return authResult;
    }

    const { user } = authResult;

    // Check subscription for household creation
    const subCheck = await requireSubscription(user);
    if (subCheck) {
      Logger.warn('Subscription required for household creation', {
        requestId,
        userId: user.id,
      });
      return subCheck;
    }

    const deletionCheck = requireNoPendingDeletion(user);
    if (deletionCheck) return deletionCheck;

    const body = await req.json();

    // Validate request body (length is enforced by HouseholdService.createHousehold)
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      Logger.warn('Invalid household name provided', {
        requestId,
        userId: user.id,
      });
      const errorResponse = createErrorResponse(
        ErrorCode.MISSING_REQUIRED_FIELD,
        'Household name is required',
        { field: 'name' },
        requestId,
      );
      return NextResponse.json(errorResponse, {
        status: getHttpStatusCode(ErrorCode.MISSING_REQUIRED_FIELD),
      });
    }

    // Create household with user as owner
    const household = await HouseholdService.createHousehold(
      user.id,
      body.name.trim(),
    );

    Logger.info('Household created successfully', {
      requestId,
      userId: user.id,
      context: { householdId: household.id, householdName: household.name },
    });
    return NextResponse.json(household, { status: 201 });
  } catch (error) {
    if (error instanceof HouseholdError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    Logger.error('Error creating household', error as Error, { requestId });
    const errorResponse = createErrorResponse(
      ErrorCode.DATABASE_ERROR,
      'Failed to create household',
      undefined,
      requestId,
    );
    return NextResponse.json(errorResponse, {
      status: getHttpStatusCode(ErrorCode.DATABASE_ERROR),
    });
  }
}
