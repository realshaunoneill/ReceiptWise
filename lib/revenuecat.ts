import { type GrantInput } from '@/lib/services/entitlement-service';
import { type GrantStatus } from '@/lib/entitlements';

/**
 * RevenueCat, which sells Premium in the app through the App Store and Google Play. The app
 * identifies each person to it by their users.id (src/purchases in the app), so a subscriber here
 * is one of our users. Its API is the source of truth: webhooks only say "look again", and this
 * module turns what RevenueCat says into premium_grants (lib/services/store-premium.ts writes
 * them). The REST v1 API, with the project's secret key.
 *
 * Without REVENUECAT_SECRET_KEY nothing here is reachable: the routes answer 503 and the cron
 * does nothing, so the website runs as it did before in-app purchase existed.
 */

const API = 'https://api.revenuecat.com/v1';

/** The entitlement the app's products unlock (RevenueCat dashboard › Entitlements). */
export const PREMIUM_ENTITLEMENT = 'premium';

export function isRevenueCatConfigured(): boolean {
  return Boolean(process.env.REVENUECAT_SECRET_KEY);
}

/** One subscription, as GET /subscribers/{id} lists it (keyed by the store's product id). */
export type RcSubscription = {
  store: string;
  is_sandbox?: boolean;
  period_type?: string | null; // 'normal' | 'trial' | 'intro' | 'prepaid'
  purchase_date?: string | null;
  original_purchase_date?: string | null;
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
  refunded_at?: string | null;
  ownership_type?: string | null;
};

export type RcSubscriber = {
  original_app_user_id?: string;
  management_url?: string | null;
  entitlements?: Record<string, { product_identifier?: string; expires_date?: string | null; grace_period_expires_date?: string | null }>;
  subscriptions?: Record<string, RcSubscription>;
};

async function request(method: 'GET' | 'DELETE', path: string): Promise<Response> {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) throw new Error('REVENUECAT_SECRET_KEY is not set');
  return fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, cache: 'no-store' });
}

/** What RevenueCat knows about this person (it makes an empty subscriber if it has none). */
export async function getSubscriber(appUserId: string): Promise<RcSubscriber> {
  const res = await request('GET', `/subscribers/${encodeURIComponent(appUserId)}`);
  if (!res.ok) throw new Error(`RevenueCat answered ${res.status} for the subscriber`);
  const body = (await res.json()) as { subscriber?: RcSubscriber };
  return body.subscriber ?? {};
}

/** Forget the subscriber (an account deleted). A missing one is already gone. */
export async function deleteSubscriber(appUserId: string): Promise<void> {
  const res = await request('DELETE', `/subscribers/${encodeURIComponent(appUserId)}`);
  if (!res.ok && res.status !== 404) throw new Error(`RevenueCat answered ${res.status} deleting the subscriber`);
}

const STORES: Record<string, 'app_store' | 'play_store'> = { app_store: 'app_store', play_store: 'play_store' };

const time = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * Where a subscription stands at `now`, and until when it gives Premium. A cancelled one keeps
 * Premium to the end of what was paid for (it's still 'active', with willRenew false); after that
 * a store's grace period, while it retries the payment, still gives it.
 */
export function subscriptionState(subscription: RcSubscription, now: Date): { status: GrantStatus; expiresAt: Date | null } {
  const expires = time(subscription.expires_date);
  const grace = time(subscription.grace_period_expires_date);
  if (subscription.refunded_at) return { status: 'refunded', expiresAt: expires };
  if (!expires) return { status: 'active', expiresAt: null };
  if (expires > now) {
    if (subscription.billing_issues_detected_at) return { status: 'billing_issue', expiresAt: expires };
    return { status: subscription.period_type === 'trial' ? 'trialing' : 'active', expiresAt: expires };
  }
  if (grace && grace > now) return { status: 'grace', expiresAt: grace };
  return { status: 'expired', expiresAt: expires };
}

/** The key a store subscription's grant is kept under: per person and product, stable across renewals. */
export function storeGrantKey(appUserId: string, productId: string): string {
  return `${appUserId}:${productId}`;
}

/**
 * The person's App Store and Google Play subscriptions as Premium grants. ReceiptWise sells one
 * thing, so every store subscription is Premium; RevenueCat's own promotional grants and other
 * stores are left out (comp Premium is given here, not there). Sandbox purchases count, so App
 * Review and TestFlight can buy; the environment is recorded.
 */
export function grantsFromSubscriber(appUserId: string, subscriber: RcSubscriber, now: Date): GrantInput[] {
  return Object.entries(subscriber.subscriptions ?? {}).flatMap(([productId, subscription]) => {
    const source = STORES[subscription.store];
    if (!source) return [];
    const { status, expiresAt } = subscriptionState(subscription, now);
    return [{
      userId: appUserId,
      source,
      externalId: storeGrantKey(appUserId, productId),
      status,
      productId,
      expiresAt,
      willRenew: !subscription.unsubscribe_detected_at && !subscription.refunded_at && status !== 'expired',
      environment: subscription.is_sandbox ? 'sandbox' : 'production',
    }];
  });
}

/** Whether an app user id is one of ours: RevenueCat's anonymous ids ($RCAnonymousID:…) are not. */
export function isOurUserId(appUserId: unknown): appUserId is string {
  return typeof appUserId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appUserId);
}

/** Every user a webhook event is about (a transfer names two, and aliases can name more). */
export function usersInEvent(event: Record<string, unknown>): string[] {
  const ids: unknown[] = [event.app_user_id, event.original_app_user_id];
  for (const key of ['aliases', 'transferred_from', 'transferred_to']) {
    const list = event[key];
    if (Array.isArray(list)) ids.push(...list);
  }
  return [...new Set(ids.filter(isOurUserId).map((id) => id.toLowerCase()))];
}
