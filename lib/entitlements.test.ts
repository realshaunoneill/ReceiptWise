import { describe, expect, it } from 'vitest';
import { decideHouseholdCover, decidePremium, isLiveGrant, stripeGrantStatus, type CoverPair } from './entitlements';

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

describe('decideHouseholdCover', () => {
  const at = (day: number) => new Date(Date.UTC(2026, 9, day));
  const pairs = (payerId: string, members: Array<[string, number]>): CoverPair[] =>
    members.map(([memberId, day]) => ({ payerId, memberId, joinedAt: at(day) }));

  it('covers everyone a payer shares a household with, up to the limit, earliest to join first', () => {
    const cover = decideHouseholdCover(pairs('pay', [['m6', 6], ['m1', 1], ['m2', 2], ['m3', 3], ['m4', 4], ['m5', 5]]));
    expect([...cover.keys()].sort()).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']);
    expect(cover.get('m1')).toBe('pay');
    expect(cover.has('m6')).toBe(false);
  });

  it('counts someone in two of the payer\'s households once, from their first join', () => {
    // Two households with the same payer: 'twice' is in both, so there are five people, all covered.
    const cover = decideHouseholdCover([
      ...pairs('pay', [['twice', 1], ['a', 2], ['b', 3], ['c', 4]]),
      ...pairs('pay', [['twice', 5], ['late', 6]]),
    ]);
    expect([...cover.keys()].sort()).toEqual(['a', 'b', 'c', 'late', 'twice']);
  });

  it('lets a second payer cover people the first had no room for', () => {
    const members: Array<[string, number]> = [['m1', 1], ['m2', 2], ['m3', 3], ['m4', 4], ['m5', 5], ['m6', 6], ['m7', 7]];
    const cover = decideHouseholdCover([...pairs('payA', members), ...pairs('payB', members)]);
    expect(cover.size).toBe(7);
    expect(cover.get('m1')).toBe('payA');
    expect(cover.get('m6')).toBe('payB');
  });

  it('never covers a payer through themselves, and covers nobody without a payer', () => {
    expect(decideHouseholdCover([{ payerId: 'pay', memberId: 'pay', joinedAt: at(1) }]).size).toBe(0);
    expect(decideHouseholdCover([]).size).toBe(0);
  });
});
