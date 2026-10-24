import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { isCronAuthorized } from '@/lib/cron-auth';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { SubscriptionService } from '@/lib/services/subscription-service';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * GET /api/cron/bills-daily (02:00 UTC)
 *
 * Brings every tracked subscription and bill up to date: creates the payment rows for cycles
 * that came round, marks direct debits, standing orders and card payments paid once collected,
 * and marks the rest (paid by hand) missed after the grace period. This used to happen on every list request instead, with
 * no lock, which is how duplicate rows were created.
 *
 * Crons only run in production. Nothing else depends on this having run: the plan computes
 * occurrences that have no row yet, and the list counts overdue payments from their dates.
 */
export async function GET(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  if (!isCronAuthorized(req)) {
    submitLogEvent('cron', 'Unauthorized call to bills-daily cron', correlationId, {}, true);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await SubscriptionService.runDaily();
    submitLogEvent('cron', `bills-daily: ${result.created} created, ${result.assumedPaid} assumed paid, ${result.missed} missed`, correlationId, result);
    return NextResponse.json(result);
  } catch (error) {
    submitLogEvent('cron', `bills-daily failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'bills-daily failed' }, { status: 500 });
  }
}
