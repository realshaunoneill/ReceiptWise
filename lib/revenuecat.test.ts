import { describe, expect, it } from 'vitest';
import { grantsFromSubscriber, isOurUserId, subscriptionState, usersInEvent, type RcSubscriber } from './revenuecat';

const now = new Date('2026-11-10T12:00:00Z');
const USER = '22e5a194-4ac5-4ace-ab38-3b9ab0970c73';
const sub = (extra: Partial<NonNullable<RcSubscriber['subscriptions']>[string]>) => ({
  store: 'app_store', is_sandbox: false, period_type: 'normal', purchase_date: '2026-10-27T10:00:00Z', original_purchase_date: '2026-10-20T10:00:00Z',
  expires_date: '2026-11-27T10:00:00Z', grace_period_expires_date: null, unsubscribe_detected_at: null, billing_issues_detected_at: null, refunded_at: null, ...extra,
});

describe('subscriptionState', () => {
  it('is active, or trialing, until it expires', () => {
    expect(subscriptionState(sub({}), now)).toEqual({ status: 'active', expiresAt: new Date('2026-11-27T10:00:00Z') });
    expect(subscriptionState(sub({ period_type: 'trial' }), now).status).toBe('trialing');
  });

  it('keeps Premium to the end of what was paid for after cancelling', () => {
    expect(subscriptionState(sub({ unsubscribe_detected_at: '2026-11-01T00:00:00Z' }), now).status).toBe('active');
  });

  it('marks a failed payment while still in the period, and gives the grace period after it', () => {
    expect(subscriptionState(sub({ billing_issues_detected_at: '2026-11-09T00:00:00Z' }), now).status).toBe('billing_issue');
    const lapsed = sub({ expires_date: '2026-11-08T10:00:00Z', billing_issues_detected_at: '2026-11-08T10:00:00Z', grace_period_expires_date: '2026-11-24T10:00:00Z' });
    expect(subscriptionState(lapsed, now)).toEqual({ status: 'grace', expiresAt: new Date('2026-11-24T10:00:00Z') });
  });

  it('ends at expiry without a grace period, and at once when refunded', () => {
    expect(subscriptionState(sub({ expires_date: '2026-11-08T10:00:00Z' }), now).status).toBe('expired');
    expect(subscriptionState(sub({ refunded_at: '2026-11-02T00:00:00Z' }), now).status).toBe('refunded');
  });
});

describe('grantsFromSubscriber', () => {
  it('turns App Store and Play subscriptions into grants, one per product', () => {
    const grants = grantsFromSubscriber(USER, {
      subscriptions: {
        'io.receiptwise.premium.monthly': sub({ is_sandbox: true, unsubscribe_detected_at: '2026-11-01T00:00:00Z' }),
        'premium:yearly': sub({ store: 'play_store', expires_date: '2027-10-27T10:00:00Z' }),
        promo: sub({ store: 'promotional' }),
      },
    }, now);
    expect(grants).toEqual([
      expect.objectContaining({ userId: USER, source: 'app_store', externalId: `${USER}:io.receiptwise.premium.monthly`, status: 'active', willRenew: false, environment: 'sandbox', productId: 'io.receiptwise.premium.monthly' }),
      expect.objectContaining({ source: 'play_store', externalId: `${USER}:premium:yearly`, status: 'active', willRenew: true, environment: 'production' }),
    ]);
  });

  it('gives nothing for a subscriber with no subscriptions', () => {
    expect(grantsFromSubscriber(USER, {}, now)).toEqual([]);
  });
});

describe('webhook users', () => {
  it("names every one of our users in an event, and none of RevenueCat's anonymous ids", () => {
    const other = '7b23b3ca-aee9-46d0-8981-ac8be1c89bde';
    expect(usersInEvent({ app_user_id: USER, original_app_user_id: '$RCAnonymousID:abc', transferred_from: ['$RCAnonymousID:abc'], transferred_to: [other], aliases: [USER.toUpperCase()] }))
      .toEqual([USER, other]);
    expect(isOurUserId('$RCAnonymousID:abc')).toBe(false);
  });
});
