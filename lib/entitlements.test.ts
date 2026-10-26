import { describe, expect, it } from 'vitest';
import { decidePremium, isLiveGrant, stripeGrantStatus } from './entitlements';

const now = new Date('2026-10-26T12:00:00Z');
const later = new Date('2026-11-26T12:00:00Z');
const earlier = new Date('2026-09-26T12:00:00Z');

describe('isLiveGrant', () => {
  it('gives Premium while entitled and not past its end', () => {
    expect(isLiveGrant({ source: 'stripe', status: 'active', expiresAt: null }, now)).toBe(true);
    expect(isLiveGrant({ source: 'app_store', status: 'trialing', expiresAt: later }, now)).toBe(true);
    expect(isLiveGrant({ source: 'play_store', status: 'grace', expiresAt: later }, now)).toBe(true);
    expect(isLiveGrant({ source: 'stripe', status: 'billing_issue', expiresAt: null }, now)).toBe(true);
  });

  it('stops at the end date, whatever the status says', () => {
    expect(isLiveGrant({ source: 'app_store', status: 'active', expiresAt: earlier }, now)).toBe(false);
    expect(isLiveGrant({ source: 'comp', status: 'active', expiresAt: now }, now)).toBe(false);
  });

  it('gives nothing once cancelled, expired, refunded or never started', () => {
    for (const status of ['cancelled', 'expired', 'refunded', 'none', 'something-new']) {
      expect(isLiveGrant({ source: 'stripe', status, expiresAt: null }, now)).toBe(false);
    }
  });
});

describe('decidePremium', () => {
  it('is Premium if any source gives it, so one lapsing never switches off another', () => {
    const grants = [
      { source: 'stripe', status: 'cancelled', expiresAt: null },
      { source: 'app_store', status: 'active', expiresAt: later },
    ];
    expect(decidePremium(grants, now)).toEqual({ premium: true, grant: grants[1] });
  });

  it('names a paid source before a comp grant', () => {
    const grants = [
      { source: 'comp', status: 'active', expiresAt: null },
      { source: 'play_store', status: 'active', expiresAt: later },
    ];
    expect(decidePremium(grants, now).grant?.source).toBe('play_store');
  });

  it('is not Premium with no live grant, or none at all', () => {
    expect(decidePremium([], now)).toEqual({ premium: false, grant: null });
    expect(decidePremium([{ source: 'comp', status: 'active', expiresAt: earlier }], now).premium).toBe(false);
  });
});

describe('stripeGrantStatus', () => {
  it('keeps Premium exactly where Stripe gave it before: active, trialing and past_due', () => {
    const entitled = ['active', 'trialing', 'past_due'];
    for (const status of ['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused', undefined]) {
      const live = isLiveGrant({ source: 'stripe', status: stripeGrantStatus(status), expiresAt: null }, now);
      expect(live).toBe(entitled.includes(status as string));
    }
  });
});
