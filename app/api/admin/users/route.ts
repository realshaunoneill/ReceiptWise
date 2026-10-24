import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getAuthenticatedUser, requireAdmin } from '@/lib/auth-helpers';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { randomUUID } from 'crypto';
import { userWithCountsFields } from './users-query';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // Check if user is admin
    const adminCheck = await requireAdmin(user, correlationId);
    if (adminCheck) return adminCheck;

    // Every user with their receipt and household counts (see users-query.ts).
    const usersWithCounts = await db.select(userWithCountsFields).from(users);

    submitLogEvent('admin', 'Admin viewed users list', correlationId, { adminId: user.id });

    return NextResponse.json(usersWithCounts);
  } catch (error) {
    submitLogEvent('admin', `Error fetching users: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 },
    );
  }
}
