import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { HouseholdError, HouseholdService } from '@/lib/services/household-service';

/**
 * POST /api/households/:id/leave: the signed-in member leaves. An owner with other members must
 * transfer ownership first (the service says so); an owner alone deletes the household by leaving.
 * The website does this with a server action (lib/household-actions.ts); this is the app's way.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  const authResult = await getAuthenticatedUser(correlationId);
  if (authResult instanceof NextResponse) return authResult;
  const { id: householdId } = await params;
  try {
    const { deletedHousehold } = await HouseholdService.leaveMember(householdId, authResult.user.id);
    submitLogEvent('household', 'Left a household', correlationId, { householdId, userId: authResult.user.id, deletedHousehold });
    return NextResponse.json({ ok: true, deletedHousehold });
  } catch (error) {
    if (error instanceof HouseholdError) return NextResponse.json({ error: error.message }, { status: error.status });
    submitLogEvent('household', `Leaving a household failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { householdId }, true);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
