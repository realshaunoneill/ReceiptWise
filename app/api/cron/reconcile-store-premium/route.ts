import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { and, gte, inArray, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { premiumGrants } from '@/lib/db/schema';
import { isCronAuthorized } from '@/lib/cron-auth';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { isRevenueCatConfigured } from '@/lib/revenuecat';
import { syncStorePremium } from '@/lib/services/store-premium';
import { reconcileHouseholdCover } from '@/lib/services/entitlement-service';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** People checked per run; the rest wait an hour. */
const MAX_USERS_PER_RUN = 100;

/**
 * GET /api/cron/reconcile-store-premium (hourly): first, household cover, worked out again for
 * everyone, so a change that missed its refresh (a Stripe trial running out, a failed refresh) is
 * put right within the hour. Then everyone with an App Store or Google Play subscription that's
 * live, or changed in the last 40 days, in case a RevenueCat webhook was lost. A refund or an
 * expiry then switches Premium off within the hour.
 */
export async function GET(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  if (!isCronAuthorized(req)) {
    submitLogEvent('subscription', 'Unauthorized call to reconcile-store-premium cron', correlationId, {}, true);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let household: { covered: number; changed: number } | null = null;
  try {
    household = await reconcileHouseholdCover(correlationId);
  } catch (error) {
    submitLogEvent('subscription', `Household cover reconcile failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
  }
  if (!isRevenueCatConfigured()) return NextResponse.json({ household, stores: 'not configured' });

  const since = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
  const rows = await db
    .selectDistinct({ userId: premiumGrants.userId })
    .from(premiumGrants)
    .where(and(
      inArray(premiumGrants.source, ['app_store', 'play_store']),
      or(inArray(premiumGrants.status, ['active', 'trialing', 'grace', 'billing_issue']), gte(premiumGrants.updatedAt, since)),
    ))
    .limit(MAX_USERS_PER_RUN);

  let changed = 0;
  const failed: string[] = [];
  for (const { userId } of rows) {
    try {
      if ((await syncStorePremium(userId, correlationId)).changed) changed++;
    } catch (error) {
      failed.push(userId);
      submitLogEvent('subscription', `Store Premium reconcile failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { userId }, true);
    }
  }
  return NextResponse.json({ household, checked: rows.length, changed, failed: failed.length });
}
