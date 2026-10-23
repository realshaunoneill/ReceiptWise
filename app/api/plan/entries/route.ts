import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { planEntries } from '@/lib/db/schema';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { canFileFinanceRowUnder } from '@/lib/services/finance-access';
import { createEntriesSchema, parseBody, readJson } from '@/lib/validation/finance';

export const runtime = 'nodejs';

// POST /api/plan/entries - Add one-off lines to a period: one entry, or { entries: [...] } for a
// pasted list. An entry belongs to whichever period its date falls in.
export async function POST(req: NextRequest) {
  const guard = await guardFinanceRoute(req, { mutating: true, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;

  try {
    const parsed = parseBody(createEntriesSchema, await readJson(req));
    if (parsed instanceof NextResponse) return parsed;
    const inputs = 'entries' in parsed.data ? parsed.data.entries : [parsed.data];

    for (const householdId of new Set(inputs.map((input) => input.householdId ?? null))) {
      if (!(await canFileFinanceRowUnder(householdId, user.id, entitlements))) {
        return NextResponse.json({ error: householdId ? 'Not a member of this household' : 'Active subscription required' }, { status: 403 });
      }
    }

    const now = new Date();
    const created = await db
      .insert(planEntries)
      .values(inputs.map((input) => ({
        userId: user.id,
        householdId: input.householdId ?? null,
        date: input.date,
        label: input.label,
        amount: input.amount,
        currency: input.currency ?? user.currency ?? 'EUR',
        direction: input.direction,
        category: input.category ?? null,
        doneAt: input.done ? now : null,
        notes: input.notes ?? null,
      })))
      .returning();

    submitLogEvent('finance', `Created ${created.length} plan entr${created.length === 1 ? 'y' : 'ies'}`, correlationId, { count: created.length });
    return NextResponse.json('entries' in parsed.data ? created : created[0], { status: 201, headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('finance', `Error creating plan entries: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to add to the plan' }, { status: 500 });
  }
}
