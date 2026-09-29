import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, householdUsers } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { eq, and } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * PATCH /api/users/default-household
 * Update the user's default household
 */
export async function PATCH(req: NextRequest) {
  try {
    // getAuthenticatedUser rather than a bare auth() so blocked accounts are rejected here too.
    const authResult = await getAuthenticatedUser();
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await req.json();
    const { householdId } = body;

    // If householdId is provided, verify user has access to it
    if (householdId) {
      const membership = await db
        .select()
        .from(householdUsers)
        .where(
          and(
            eq(householdUsers.userId, user.id),
            eq(householdUsers.householdId, householdId),
          ),
        )
        .limit(1);

      if (membership.length === 0) {
        return NextResponse.json(
          { error: 'You do not have access to this household' },
          { status: 403 },
        );
      }
    }

    // Update the user's default household
    await db
      .update(users)
      .set({
        defaultHouseholdId: householdId || null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({
      success: true,
      defaultHouseholdId: householdId || null,
    });
  } catch (error) {
    console.error('Error updating default household:', error);
    return NextResponse.json(
      { error: 'Failed to update default household' },
      { status: 500 },
    );
  }
}
