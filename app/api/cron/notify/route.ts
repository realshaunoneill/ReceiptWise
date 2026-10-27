import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { isCronAuthorized } from '@/lib/cron-auth';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { morningRound } from '@/lib/push/morning';
import { sendHeld } from '@/lib/push/send';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * GET /api/cron/notify (hourly, at :05): push notifications held for quiet hours that are now
 * due, and the 9 am round for whoever's local time is 9 o'clock (lib/push/morning.ts).
 */
export async function GET(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  if (!isCronAuthorized(req)) {
    submitLogEvent('cron', 'Unauthorized call to notify cron', correlationId, {}, true);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const now = new Date();
    const heldSent = await sendHeld(now, correlationId);
    const morning = await morningRound(now, correlationId);
    submitLogEvent('cron', `notify: ${heldSent} held sent, ${morning.sent} sent in the morning round`, correlationId, { heldSent, ...morning });
    return NextResponse.json({ heldSent, morning });
  } catch (error) {
    submitLogEvent('cron', `notify failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'notify failed' }, { status: 500 });
  }
}
