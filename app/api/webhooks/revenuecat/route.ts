import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID, timingSafeEqual } from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { revenuecatEvents, users } from '@/lib/db/schema';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { isRevenueCatConfigured, usersInEvent } from '@/lib/revenuecat';
import { syncStorePremium } from '@/lib/services/store-premium';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** The Authorization header RevenueCat sends, compared in constant time. Fails closed when unset. */
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!expected) return false;
  const a = Buffer.from(req.headers.get('authorization') ?? '');
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST /api/webhooks/revenuecat: an App Store or Google Play subscription changed (bought,
 * renewed, cancelled, refunded, transferred). The body is only a nudge: each user it names is
 * looked up again in RevenueCat's API (lib/services/store-premium.ts), never trusted as sent. An
 * event is handled once (revenuecat_events), and answered 500 on a failure so RevenueCat retries.
 */
export async function POST(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  if (!isRevenueCatConfigured() || !process.env.REVENUECAT_WEBHOOK_AUTH) {
    return NextResponse.json({ error: 'In-app purchase is not set up' }, { status: 503 });
  }
  if (!isAuthorized(req)) {
    submitLogEvent('subscription', 'RevenueCat webhook with a wrong Authorization header', correlationId, {}, true);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { event?: Record<string, unknown> } | null;
  const event = body?.event;
  const id = typeof event?.id === 'string' ? event.id : null;
  const type = typeof event?.type === 'string' ? event.type : 'UNKNOWN';
  if (!event || !id) return NextResponse.json({ error: 'No event' }, { status: 400 });

  // Once each: a retried delivery of an event already handled is acknowledged and ignored.
  const [inserted] = await db
    .insert(revenuecatEvents)
    .values({ id, type, appUserId: typeof event.app_user_id === 'string' ? event.app_user_id : null })
    .onConflictDoNothing()
    .returning();
  if (!inserted) {
    const [seen] = await db.select().from(revenuecatEvents).where(eq(revenuecatEvents.id, id)).limit(1);
    if (seen?.processedAt) return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    const named = usersInEvent(event);
    // Only accounts that exist: an id RevenueCat has from elsewhere (a deleted account) is skipped.
    const known = named.length
      ? (await db.select({ id: users.id }).from(users).where(inArray(users.id, named))).map((row) => row.id)
      : [];
    for (const userId of known) await syncStorePremium(userId, correlationId);

    await db.update(revenuecatEvents).set({ processedAt: new Date(), error: null }).where(eq(revenuecatEvents.id, id));
    submitLogEvent('subscription', `RevenueCat ${type}: ${known.length} account(s) synced`, correlationId, { eventId: id, type, users: known });
    return NextResponse.json({ ok: true, synced: known.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await db.update(revenuecatEvents).set({ error: message.slice(0, 500) }).where(eq(revenuecatEvents.id, id));
    submitLogEvent('subscription', `RevenueCat ${type} failed: ${message}`, correlationId, { eventId: id }, true);
    return NextResponse.json({ error: 'Failed to process the event' }, { status: 500 });
  }
}
