import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { HouseholdError, HouseholdService } from '@/lib/services/household-service';

/**
 * POST /api/households/:id/transfer-ownership { userId }: the owner hands the household to another
 * member. The website does this with a server action (lib/household-actions.ts); this is the app's.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  const authResult = await getAuthenticatedUser(correlationId);
  if (authResult instanceof NextResponse) return authResult;
  const { id: householdId } = await params;
  const body = (await req.json().catch(() => null)) as { userId?: unknown } | null;
  if (typeof body?.userId !== 'string' || !body.userId) {
    return NextResponse.json({ error: 'Choose who to hand the household to' }, { status: 400 });
  }
  try {
    await HouseholdService.transferOwnership(householdId, body.userId, authResult.user.id);
    submitLogEvent('household', 'Transferred household ownership', correlationId, { householdId, from: authResult.user.id, to: body.userId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof HouseholdError) return NextResponse.json({ error: error.message }, { status: error.status });
    submitLogEvent('household', `Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { householdId }, true);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
