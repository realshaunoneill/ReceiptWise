import Stripe from 'stripe';
import { UserService } from './services/user-service';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { getAppUrl } from '@/lib/app-url';

/*
 * This module used to start with 'use server', which turns every exported async function into
 * a Server Action — a POST endpoint callable by anyone with its action ID, with no auth check —
 * the moment any client component imported it. Only route handlers and server components use
 * it, so it is a plain server module.
 */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

/** Stripe search-query literal for an email, with quotes and backslashes escaped. */
function emailSearchQuery(email: string): string {
  return `email:'${email.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * Statuses that grant access. `past_due` is included on purpose: Stripe is still retrying the
 * card, and cutting someone off on the first failed renewal of a €1.99 plan loses more
 * customers than it protects. If the retries run out Stripe moves the subscription to
 * `canceled` or `unpaid`, and access ends then.
 */
const ENTITLED_STATUSES: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due'];

/**
 * The subscription that decides a customer's access: the first entitled one, else the most
 * recent. Listing only the newest (`limit: 1`) let an abandoned or expired subscription created
 * after a live one mark a paying customer as unsubscribed.
 */
function pickSubscription(subscriptions: Stripe.Subscription[]): Stripe.Subscription | undefined {
  return subscriptions.find((sub) => ENTITLED_STATUSES.includes(sub.status)) ?? subscriptions[0];
}

/**
 * The customer's live (entitled) subscription, if any. Used to refuse a second checkout, which
 * would otherwise bill the customer twice.
 */
export async function getLiveSubscription(customerId: string): Promise<Stripe.Subscription | null> {
  const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
  return subscriptions.data.find((sub) => ENTITLED_STATUSES.includes(sub.status)) ?? null;
}

/**
 * The free trial is for first-time subscribers only. It used to be attached to every checkout,
 * so cancelling and re-subscribing granted a fresh trial each time.
 */
async function hasHadSubscription(customerId: string): Promise<boolean> {
  const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 1 });
  return subscriptions.data.length > 0;
}

/** Trial length configured for the product, or 0 when trials are off. */
function configuredTrialDays(): number {
  const trialDays = process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS
    ? parseInt(process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS, 10)
    : 0;
  return trialDays > 0 && !isNaN(trialDays) ? trialDays : 0;
}

/**
 * Trial days this customer would get at checkout: the configured length for someone who has
 * never subscribed, else 0. The in-app upgrade prompts read this so they never promise a returning
 * customer a trial that checkout will not grant.
 */
export async function getTrialDaysForCustomer(customerId: string | null | undefined): Promise<number> {
  const trialDays = configuredTrialDays();
  if (!trialDays || !customerId) return trialDays;
  try {
    return (await hasHadSubscription(customerId)) ? 0 : trialDays;
  } catch {
    // Customer deleted in Stripe: checkout will create a fresh one, which is eligible.
    return trialDays;
  }
}

/**
 * Creates a Stripe customer for a user with comprehensive metadata
 * and updates the database with the customer ID
 */
async function createStripeCustomer(
  userId: string,
  email: string,
  clerkId: string,
  correlationId: CorrelationId,
): Promise<string> {
  try {
    const { UserService } = await import('@/lib/services/user-service');

    // Check if customer already exists in Stripe by email
    const existingCustomer = await stripe.customers.search({
      query: emailSearchQuery(email),
    });

    if (existingCustomer.data.length > 0) {
      const customerId = existingCustomer.data[0].id;
      submitLogEvent('stripe', `Found existing Stripe customer ${customerId} for ${email}`, correlationId, { userId, customerId, email });

      // Update user record with the existing Stripe customer ID
      // This ensures the database stays in sync even if the customer was created elsewhere
      await UserService.updateStripeCustomerId(userId, customerId);

      submitLogEvent('stripe', `Updated database with existing Stripe customer ID for user ${userId}`, correlationId, { userId, customerId });

      return customerId;
    }

    // Create new Stripe customer with comprehensive metadata
    const customer = await stripe.customers.create({
      email: email,
      metadata: {
        userId: userId,
        clerkId: clerkId,
        email: email,
      },
    });

    submitLogEvent('stripe', `Created new Stripe customer ${customer.id} for user ${userId}`, correlationId, { userId, customerId: customer.id, email });

    // Update user record with Stripe customer ID
    await UserService.updateStripeCustomerId(userId, customer.id);

    submitLogEvent('stripe', `Updated database with Stripe customer ID for user ${userId}`, correlationId, { userId, customerId: customer.id });

    return customer.id;
  } catch (error) {
    submitLogEvent('stripe', `Failed to create Stripe customer: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { userId, email }, true);
    throw new Error('Failed to create Stripe customer');
  }
}

/**
 * Gets or creates a Stripe customer for a user
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  clerkId: string,
  stripeCustomerId: string | null | undefined,
  correlationId: CorrelationId,
): Promise<string> {
  try {
    // If user already has a Stripe customer ID, verify it exists
    if (stripeCustomerId) {
      try {
        const customer = await stripe.customers.retrieve(stripeCustomerId);
        if (!customer.deleted) {
          submitLogEvent('stripe', `Using existing Stripe customer ${stripeCustomerId}`, correlationId, { userId, customerId: stripeCustomerId });
          return stripeCustomerId;
        }
      } catch (_error) {
        submitLogEvent('stripe', 'Existing Stripe customer not found, creating new one', correlationId, { userId, stripeCustomerId });
      }
    }

    // Create customer and update database in one operation
    return await createStripeCustomer(userId, email, clerkId, correlationId);
  } catch (error) {
    submitLogEvent('stripe', `Error getting or creating Stripe customer: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { userId, email }, true);
    throw error;
  }
}

/**
 * Creates a Stripe checkout session for a subscription
 * Automatically handles customer creation if needed
 * Grants the NEXT_PUBLIC_STRIPE_TRIAL_DAYS free trial to first-time subscribers only
 *
 * Success and cancel URLs are fixed server-side. They used to be taken from the request body,
 * which let a caller point Stripe's post-payment redirect anywhere.
 */
export async function createCheckoutSession(
  userId: string,
  email: string,
  clerkId: string,
  priceId: string,
  stripeCustomerId: string | null | undefined,
  correlationId: CorrelationId,
) {
  try {
    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(
      userId,
      email,
      clerkId,
      stripeCustomerId,
      correlationId,
    );

    const trialDays = await getTrialDaysForCustomer(customerId);
    const hasValidTrial = trialDays > 0;

    if (hasValidTrial) {
      submitLogEvent('checkout', `Creating checkout session with ${trialDays} day free trial`, correlationId, {
        userId,
        priceId,
        trialDays,
      });
    }

    // Calculate trial end timestamp (current time + trial days + 5 minutes buffer)
    // The 5 minute buffer gives users time to complete the checkout process
    const trialEnd = hasValidTrial
      ? Math.floor(Date.now() / 1000) + (trialDays * 24 * 60 * 60) + (5 * 60)
      : undefined;

    const appUrl = getAppUrl();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      // Add subscription data with trial period if configured
      ...(hasValidTrial && {
        subscription_data: {
          trial_end: trialEnd,
          metadata: {
            trial_days: trialDays.toString(),
          },
        },
        custom_text: {
          submit: {
            message: `Nothing is charged today. Your ${trialDays}-day trial converts to a paid subscription unless you cancel before it ends, which you can do at any time from Settings.`,
          },
        },
      }),
      success_url: `${appUrl}/payment/successful?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/payment/failed`,
      client_reference_id: userId,
      metadata: {
        userId: userId,
        clerkId: clerkId,
        email: email,
        ...(hasValidTrial && { trial_days: trialDays.toString() }),
      },
    });

    return session;
  } catch (error) {
    submitLogEvent('checkout', `Error creating checkout session: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { userId, priceId }, true);
    throw error;
  }
}

/**
 * Syncs Stripe subscription data to the database for a customer
 * Updates the user's subscription status based on their active Stripe subscription
 */
export async function syncStripeDataToDatabase(customerId: string, correlationId: CorrelationId) {
  try {
    // Verify customer exists in Stripe
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer || customer.deleted) {
      throw new Error('Customer not found in Stripe');
    }

    // Get user from database by Stripe customer ID
    const user = await UserService.getUserByStripeCustomerId(customerId);

    if (!user) {
      throw new Error(`User not found for Stripe customer ${customerId}`);
    }

    // Get subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 20,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    const subscription = pickSubscription(subscriptions.data);

    // No subscriptions at all
    if (!subscription) {
      // Update user to not subscribed
      await UserService.updateSubscriptionStatus(user.id, false);

      submitLogEvent('subscription', `Updated user ${user.id} subscription status to false (no subscriptions)`, correlationId, { userId: user.id, customerId });

      const subData = { status: 'none' };
      return subData;
    }

    const isSubscribed = ENTITLED_STATUSES.includes(subscription.status);

    // Update user subscription status in database
    await UserService.updateSubscriptionStatus(user.id, isSubscribed);

    submitLogEvent('subscription', `Updated user ${user.id} subscription status to ${isSubscribed} (${subscription.status})`, correlationId, { userId: user.id, customerId, subscriptionStatus: subscription.status, isSubscribed });

    // Store complete subscription state
    const subData = {
      subscriptionId: subscription.id,
      status: subscription.status,
      priceId: subscription.items.data[0].price.id,
      // Since API version 2025-03-31 the period lives on the subscription item, not the subscription.
      currentPeriodEnd: subscription.items.data[0]?.current_period_end ?? 0,
      currentPeriodStart: subscription.items.data[0]?.current_period_start ?? 0,
      trialEnd: subscription.trial_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      paymentMethod:
        subscription.default_payment_method &&
        typeof subscription.default_payment_method !== 'string'
          ? {
              brand: subscription.default_payment_method.card?.brand ?? null,
              last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : null,
    };

    return subData;
  } catch (error) {
    submitLogEvent('stripe', `Error syncing Stripe data to database: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { customerId }, true);
    throw error;
  }
}

/**
 * Searches for a Stripe customer by email and re-associates it with the user if found
 * Returns the Stripe customer ID if found and re-associated, or null if not found
 */
export async function findAndReassociateStripeCustomer(
  userId: string,
  email: string,
  correlationId: CorrelationId,
): Promise<string | null> {
  try {
    submitLogEvent('stripe', `Searching for Stripe customer by email: ${email}`, correlationId, { userId, email });

    // Search for existing Stripe customer by email
    const existingCustomer = await stripe.customers.search({
      query: emailSearchQuery(email),
    });

    if (existingCustomer.data.length > 0) {
      const customerId = existingCustomer.data[0].id;

      submitLogEvent('stripe', `Found existing Stripe customer ${customerId} for ${email}`, correlationId, { userId, customerId, email });

      // Update the user record with the found Stripe customer ID
      await UserService.updateStripeCustomerId(userId, customerId);

      submitLogEvent('stripe', `Re-associated Stripe customer ID ${customerId} with user ${userId}`, correlationId, { userId, customerId });

      return customerId;
    }

    submitLogEvent('stripe', `No Stripe customer found for email ${email}`, correlationId, { userId, email });
    return null;
  } catch (error) {
    submitLogEvent('stripe', `Error searching for Stripe customer: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { userId, email }, true);
    return null;
  }
}

/**
 * Creates a Stripe billing portal session for a customer to manage their subscription
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string,
  correlationId: CorrelationId,
): Promise<string> {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    submitLogEvent('stripe', `Created billing portal session for customer ${customerId}`, correlationId, { customerId });

    return session.url;
  } catch (error) {
    submitLogEvent('stripe', `Error creating billing portal session: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { customerId }, true);
    throw error;
  }
}
