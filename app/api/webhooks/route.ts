import { headers } from 'next/headers';
import Stripe from 'stripe';
import { type NextRequest, NextResponse } from 'next/server';
import { syncStripeDataToDatabase } from '@/lib/stripe';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { randomUUID } from 'crypto';
import { UserService } from '@/lib/services/user-service';

// Route configuration - Webhooks need to respond quickly
export const runtime = 'nodejs';
export const maxDuration = 30;

const allowedEvents: Stripe.Event.Type[] = [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'customer.subscription.paused',
    'customer.subscription.resumed',
    'customer.subscription.pending_update_applied',
    'customer.subscription.pending_update_expired',
    'customer.subscription.trial_will_end',
    'invoice.paid',
    'invoice.payment_failed',
    'invoice.payment_action_required',
    'invoice.upcoming',
    'invoice.marked_uncollectible',
    'invoice.payment_succeeded',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'payment_intent.canceled',

    'charge.refunded',
  ];

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

/**
 * Stripe webhook handler.
 *
 * Status codes are what make Stripe retry, so they have to be honest. This used to catch every
 * error, log it and return 200: a signature failure (for instance a signing secret from the wrong
 * Stripe mode) looked like success, Stripe never retried and never flagged the endpoint, and
 * cancellations and failed renewals silently never revoked access. Processing also ran in
 * waitUntil after the 200, so its failures were invisible to Stripe too.
 *
 * Processing is idempotent — syncStripeDataToDatabase re-reads the customer's current state from
 * Stripe rather than applying the event payload — so redelivery is always safe, and awaiting it
 * keeps well inside Stripe's timeout.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = (await headers()).get('Stripe-Signature');
  const correlationId = (request.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  if (!webhookSecret) {
    submitLogEvent('stripe', 'STRIPE_WEBHOOK_SECRET is not set; rejecting webhook', correlationId, {}, true);
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    submitLogEvent('stripe', `Webhook signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    await processEvent(event, correlationId);
  } catch (error) {
    submitLogEvent('stripe', `Webhook processing failed for ${event.type} (${event.id}): ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { eventId: event.id, eventType: event.type }, true);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function processEvent(event: Stripe.Event, correlationId: CorrelationId) {
    // Skip processing if the event isn't one I'm tracking (list of all events below)
    if (!allowedEvents.includes(event.type)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Skipping event', event.type);
      }
      return;
    };

    // All the events I track have a customerId
    const { customer: customerId } = event?.data?.object as {
      customer: string; // Sadly TypeScript does not know this
    };

    // Payment intents and charges outside a subscription (none today, but possible) carry no
    // customer. There is nothing to sync, and throwing would make Stripe retry forever.
    if (typeof customerId !== 'string') {
      submitLogEvent('stripe', `Skipping ${event.type} (${event.id}): no customer on event`, correlationId, { eventId: event.id });
      return;
    }

    // Try to find user by Stripe customer ID first
    let user = await UserService.getUserByStripeCustomerId(customerId);

    // If not found, try to re-associate by email
    if (!user) {
      submitLogEvent('stripe', `User not found by customerId ${customerId}, attempting email re-association`, correlationId, { customerId });

      try {
        // Fetch customer from Stripe to get email
        const customer = await stripe.customers.retrieve(customerId);

        if (!customer.deleted && customer.email) {
          // Try to find user by email
          user = await UserService.getUserByEmail(customer.email.toLowerCase());

          if (user) {
            // Re-associate the Stripe customer ID with this user
            await UserService.updateStripeCustomerId(user.id, customerId);
            submitLogEvent('stripe', `Re-associated Stripe customer ${customerId} with user ${user.id} via email ${customer.email}`, correlationId, {
              userId: user.id,
              customerId,
              email: customer.email,
            });
          } else {
            submitLogEvent('stripe', `No user found with email ${customer.email} for customer ${customerId}`, correlationId, { customerId, email: customer.email }, true);
            return;
          }
        } else {
          submitLogEvent('stripe', `Customer ${customerId} has no email or is deleted`, correlationId, { customerId }, true);
          return;
        }
      } catch (error) {
        submitLogEvent('stripe', `Failed to re-associate customer ${customerId}: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { customerId }, true);
        return;
      }
    }

    const kvData = await syncStripeDataToDatabase(customerId, correlationId);

    return kvData;
  }
