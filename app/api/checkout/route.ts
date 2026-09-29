import { type NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession, getLiveSubscription, getTrialDaysForCustomer } from '@/lib/stripe';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import Stripe from 'stripe';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { randomUUID } from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/checkout
 * What checkout would offer this user: currently just the trial length (0 for anyone who has
 * subscribed before), so upgrade prompts can describe it truthfully.
 */
export async function GET(request: NextRequest) {
  const correlationId = (request.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  const authResult = await getAuthenticatedUser(correlationId);
  if (authResult instanceof NextResponse) return authResult;

  const trialDays = await getTrialDaysForCustomer(authResult.user.stripeCustomerId);
  return NextResponse.json({ trialDays }, { headers: { 'Cache-Control': 'private, no-store' } });
}

/**
 * POST /api/checkout
 * Create a Stripe checkout session for subscription
 */
export async function POST(request: NextRequest) {
  const correlationId = (request.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json().catch(() => ({}));

    // Only the two Premium prices can be bought. Any other active price in the account (an old
    // test price, a future one-off) was previously purchasable by passing its ID.
    const allowedPriceIds = [process.env.STRIPE_PRICE_ID, process.env.STRIPE_ANNUAL_PRICE_ID].filter(
      (id): id is string => Boolean(id),
    );
    const priceId: string | undefined = body.priceId ?? process.env.STRIPE_PRICE_ID;

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID not configured' },
        { status: 400 },
      );
    }

    if (!allowedPriceIds.includes(priceId)) {
      return NextResponse.json(
        { error: 'This subscription plan is not available' },
        { status: 400 },
      );
    }

    // A second checkout would create a second subscription and bill twice. Stripe is the source
    // of truth here rather than users.subscribed, which can lag a webhook.
    if (user.stripeCustomerId) {
      // A customer deleted in Stripe throws here; getOrCreateStripeCustomer below replaces it.
      const liveSubscription = await getLiveSubscription(user.stripeCustomerId).catch(() => null);
      if (liveSubscription) {
        return NextResponse.json(
          {
            error: 'You already have a ReceiptWise subscription. Manage or change it under Settings → Subscription.',
            code: 'ALREADY_SUBSCRIBED',
          },
          { status: 409 },
        );
      }
    }

    // Verify the price exists and is active
    try {
      const price = await stripe.prices.retrieve(priceId, {
        expand: ['product'],
      });

      if (!price.active) {
        return NextResponse.json(
          { error: 'This subscription plan is not available' },
          { status: 400 },
        );
      }

      submitLogEvent('checkout', `Creating checkout session for price: ${(price.product as Stripe.Product).name}`, correlationId, { userId: user.id, priceId, email: user.email });
    } catch (error) {
      submitLogEvent('checkout', `Error retrieving price: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { userId: user.id, priceId }, true);
      return NextResponse.json(
        { error: 'Invalid price ID' },
        { status: 400 },
      );
    }

    // Create checkout session (handles customer creation automatically)
    const checkoutSession = await createCheckoutSession(
      user.id,
      user.email,
      user.clerkId,
      priceId,
      user.stripeCustomerId,
      correlationId,
    );

    if (!checkoutSession || !checkoutSession.url) {
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 },
      );
    }

    submitLogEvent('checkout', 'Checkout session created', correlationId, {
      sessionId: checkoutSession.id,
      userId: user.id,
      priceId,
    });

    return NextResponse.json(
      {
        url: checkoutSession.url,
        sessionId: checkoutSession.id,
      },
      { status: 200 },
    );
  } catch (error) {
    submitLogEvent('checkout', `Error creating checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { error: error instanceof Error ? error.message : undefined }, true);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
