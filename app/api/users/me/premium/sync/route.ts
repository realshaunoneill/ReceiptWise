import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { isRevenueCatConfigured } from '@/lib/revenuecat';
import { premiumSummary, syncStorePremium } from '@/lib/services/store-premium';

export const runtime = 'nodejs';

/**
 * POST /api/users/me/premium/sync: look again at the signed-in person's App Store and Google Play
 * subscriptions now, rather than waiting for RevenueCat's webhook. The app calls it after a
 * purchase or a restore, so Premium switches on before the paywall closes.
 */
export async function POST(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  const auth = await getAuthenticatedUser(correlationId);
  if (auth instanceof NextResponse) return auth;
  if (!isRevenueCatConfigured()) return NextResponse.json({ error: 'In-app purchase is not set up' }, { status: 503 });

  try {
    const state = await syncStorePremium(auth.user.id, correlationId);
    return NextResponse.json({ subscribed: state.subscribed, premium: await premiumSummary(auth.user.id) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    submitLogEvent('subscription', `Store Premium sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { userId: auth.user.id }, true);
    return NextResponse.json({ error: "Couldn't check your purchase. Try again in a moment." }, { status: 502 });
  }
}
