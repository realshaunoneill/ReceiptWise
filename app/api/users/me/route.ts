import { type NextRequest, NextResponse } from 'next/server';
import {
  createErrorResponse,
  ErrorCode,
  generateRequestId,
  getHttpStatusCode,
  Logger,
} from '@/lib/errors';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { randomUUID } from 'crypto';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';

/**
 * GET /api/users/me
 * Get current user profile (creates user if doesn't exist)
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  const correlationId = (request.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const authResult = await getAuthenticatedUser(correlationId);

    if (authResult instanceof NextResponse) {
      Logger.warn('Unauthenticated request to /api/users/me', { requestId });
      return authResult;
    }

    const { user } = authResult;

    Logger.info('User profile fetched successfully', {
      requestId,
      userId: user.id,
    });
    return NextResponse.json(user, {
      headers: {
        // Not cached: subscription state, pending deletion and currency all change through
        // mutations, and a cached copy made the UI lag them by up to a minute.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    Logger.error('Error fetching user profile', error as Error, { requestId });
    const errorResponse = createErrorResponse(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Failed to fetch user profile',
      undefined,
      requestId,
    );
    return NextResponse.json(errorResponse, {
      status: getHttpStatusCode(ErrorCode.INTERNAL_SERVER_ERROR),
    });
  }
}

/**
 * PATCH /api/users/me
 * Update user profile
 */
export async function PATCH(req: NextRequest) {
  const requestId = generateRequestId();
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const authResult = await getAuthenticatedUser(correlationId);

    if (authResult instanceof NextResponse) {
      Logger.warn('Unauthenticated request to PATCH /api/users/me', { requestId });
      return authResult;
    }

    const { user } = authResult;

    const body = await req.json();

    // Build update object based on provided fields
    const updates: Record<string, unknown> = {};

    // Email is deliberately not updatable here. It is synced from Clerk's verified primary
    // address on every request (UserService.getOrCreateUser), and it is what invitations and
    // Stripe customer re-association match on — accepting it from the body let anyone claim
    // someone else's household invite or billing portal.

    // Update currency if provided
    if (body.currency && typeof body.currency === 'string') {
      // Validate against supported currencies
      const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'NZD'];
      if (SUPPORTED_CURRENCIES.includes(body.currency)) {
        updates.currency = body.currency;
      } else {
        Logger.warn('Invalid currency provided', { requestId, context: { currency: body.currency } });
      }
    }

    // If there are fields to update
    if (Object.keys(updates).length > 0) {
      const { db } = await import('@/lib/db');
      const { users } = await import('@/lib/db/schema');
      const { eq } = await import('drizzle-orm');

      updates.updatedAt = new Date();

      const [updatedUser] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, user.id))
        .returning();

      Logger.info('User profile updated successfully', {
        requestId,
        userId: user.id,
        context: { updatedFields: Object.keys(updates).filter(k => k !== 'updatedAt') },
      });
      return NextResponse.json(updatedUser);
    }

    // If no valid fields to update, return current user
    Logger.info('No valid fields to update, returning current user', {
      requestId,
      userId: user.id,
    });
    return NextResponse.json(user);
  } catch (error) {
    Logger.error('Error updating user profile', error as Error, { requestId });
    const errorResponse = createErrorResponse(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Failed to update user profile',
      undefined,
      requestId,
    );
    return NextResponse.json(errorResponse, {
      status: getHttpStatusCode(ErrorCode.INTERNAL_SERVER_ERROR),
    });
  }
}

// DELETE - Schedule account deletion (24 hours)
export async function DELETE(request: NextRequest) {
  const requestId = generateRequestId();
  const correlationId = (request.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const authResult = await getAuthenticatedUser(correlationId);

    if (authResult instanceof NextResponse) {
      Logger.warn('Unauthorized deletion attempt', { requestId });
      return authResult;
    }

    const { user } = authResult;

    const { db } = await import('@/lib/db');
    const { users } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    // Schedule deletion for 24 hours from now
    const deletionDate = new Date();
    deletionDate.setHours(deletionDate.getHours() + 24);

    const [_updatedUser] = await db
      .update(users)
      .set({
        deletionScheduledAt: deletionDate,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    Logger.info('Account deletion scheduled', {
      requestId,
      userId: user.id,
      context: { deletionScheduledAt: deletionDate.toISOString() },
    });

    // Send alert for account deletion request
    submitLogEvent(
      'user',
      `Account deletion requested by user ${user.email}`,
      correlationId,
      { userId: user.id, email: user.email, deletionScheduledAt: deletionDate.toISOString() },
      true,
    );

    return NextResponse.json({
      success: true,
      deletionScheduledAt: deletionDate.toISOString(),
      message: 'Your account is scheduled for deletion in 24 hours. You can cancel this from Settings at any time before then.',
    });
  } catch (error) {
    Logger.error('Error scheduling account deletion', error as Error, { requestId });
    const errorResponse = createErrorResponse(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'Failed to schedule account deletion',
      undefined,
      requestId,
    );
    return NextResponse.json(errorResponse, {
      status: getHttpStatusCode(ErrorCode.INTERNAL_SERVER_ERROR),
    });
  }
}
