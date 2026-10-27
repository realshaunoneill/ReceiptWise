import { type NextRequest, NextResponse } from 'next/server';
import { submitLogEvent } from '@/lib/logging';
import { clientToday, guardFinanceRoute, PRIVATE_NO_STORE, scopeFromSearchParams } from '@/lib/route-guards';
import { loadPlan } from '@/lib/services/plan-service';
import { planGlance } from '@/shared/plan/glance';

export const runtime = 'nodejs';

// GET /api/plan/glance - The current period at a glance, for the app's home-screen widget
// (shared/plan/glance.ts): what's left, after the bills, the next payday and the next bills.
//   ?householdId=  a household's plan; else your own
//   ?today=        the phone's calendar day, YYYY-MM-DD
export async function GET(req: NextRequest) {
  const guard = await guardFinanceRoute(req, { mutating: false, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;

  try {
    const { searchParams } = new URL(req.url);
    const today = clientToday(searchParams.get('today'));
    const plan = await loadPlan(user, entitlements, scopeFromSearchParams(searchParams), today, 0);
    if (!plan) return NextResponse.json({ error: 'Active subscription required' }, { status: 403 });
    if (plan.flags.includes('no_income')) return NextResponse.json({ error: 'Add your pay first', code: 'no_income' }, { status: 409 });
    return NextResponse.json(planGlance(plan, today), { headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('plan', `Error computing the plan glance: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to load the plan' }, { status: 500 });
  }
}
