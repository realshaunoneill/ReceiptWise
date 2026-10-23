import { type NextRequest, NextResponse } from 'next/server';
import { submitLogEvent } from '@/lib/logging';
import { clientToday, guardFinanceRoute, PRIVATE_NO_STORE, scopeFromSearchParams } from '@/lib/route-guards';
import { loadPlan } from '@/lib/services/plan-service';

export const runtime = 'nodejs';

/** How far from the current period the plan can be browsed, either way. */
const MAX_OFFSET = 24;

// GET /api/plan - The plan for one period: income, every planned outgoing, what remains, the
// weekly split, and (with balances entered) what is left until payday.
//   ?offset=      periods from the current one (-1 = last, 1 = next); default 0
//   ?householdId= that household's shared plan; else your own
//   ?today=       the user's calendar day, YYYY-MM-DD
export async function GET(req: NextRequest) {
  const guard = await guardFinanceRoute(req, { mutating: false, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;

  try {
    const { searchParams } = new URL(req.url);
    const offset = Number(searchParams.get('offset') ?? '0');
    if (!Number.isInteger(offset) || Math.abs(offset) > MAX_OFFSET) {
      return NextResponse.json({ error: `offset must be a whole number between -${MAX_OFFSET} and ${MAX_OFFSET}` }, { status: 400 });
    }

    const scope = scopeFromSearchParams(searchParams);
    const plan = await loadPlan(user, entitlements, scope, clientToday(searchParams.get('today')), offset);
    if (!plan) {
      return NextResponse.json(
        { error: scope.type === 'household' ? 'Not a member of this household' : 'Active subscription required' },
        { status: 403 },
      );
    }

    return NextResponse.json(plan, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('plan', `Error computing plan: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to load the plan' }, { status: 500 });
  }
}
