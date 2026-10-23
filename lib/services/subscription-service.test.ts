import { describe, expect, it } from 'vitest';
import { collectionDay, SubscriptionService } from './subscription-service';

const at = (day: string) => new Date(`${day}T00:00:00.000Z`);

describe('collectionDay', () => {
  it('uses the due date when a bill gave one, else the cycle date', () => {
    expect(collectionDay({ dueDate: '2026-11-03', expectedDate: at('2026-11-01') })).toBe('2026-11-03');
    expect(collectionDay({ dueDate: null, expectedDate: at('2026-11-02') })).toBe('2026-11-02');
  });

  it('moves a weekend collection to the Monday', () => {
    // 2026-10-24 is a Saturday.
    expect(collectionDay({ dueDate: null, expectedDate: at('2026-10-24') })).toBe('2026-10-26');
  });
});

describe('SubscriptionService.isOverdue', () => {
  const now = at('2026-10-23');

  it('counts missed, and pending only after the grace period', () => {
    expect(SubscriptionService.isOverdue({ status: 'missed', dueDate: null, expectedDate: at('2026-10-22') }, now)).toBe(true);
    expect(SubscriptionService.isOverdue({ status: 'pending', dueDate: null, expectedDate: at('2026-10-23') }, now)).toBe(false);
    expect(SubscriptionService.isOverdue({ status: 'pending', dueDate: null, expectedDate: at('2026-10-20') }, now)).toBe(false);
    expect(SubscriptionService.isOverdue({ status: 'pending', dueDate: null, expectedDate: at('2026-10-19') }, now)).toBe(true);
    expect(SubscriptionService.isOverdue({ status: 'paid', dueDate: null, expectedDate: at('2026-01-01') }, now)).toBe(false);
  });

  it('never counts a direct debit or standing order as overdue', () => {
    const old = { status: 'pending', dueDate: null, expectedDate: at('2026-09-01') };
    expect(SubscriptionService.isOverdue(old, now, 'direct_debit')).toBe(false);
    expect(SubscriptionService.isOverdue(old, now, 'standing_order')).toBe(false);
    expect(SubscriptionService.isOverdue(old, now, 'manual')).toBe(true);
  });
});

describe('SubscriptionService.computeNextBillingDate', () => {
  const schedule = { startDate: at('2026-01-15'), billingFrequency: 'monthly', billingDay: 15, customFrequencyDays: null, endDate: null };

  it('is the first unsettled cycle from today', () => {
    expect(SubscriptionService.computeNextBillingDate(schedule, [], at('2026-10-23')).toISOString().slice(0, 10)).toBe('2026-11-15');
    expect(SubscriptionService.computeNextBillingDate(schedule, [], at('2026-10-15')).toISOString().slice(0, 10)).toBe('2026-10-15');
  });

  it('skips a cycle that is already settled', () => {
    expect(SubscriptionService.computeNextBillingDate(schedule, [at('2026-10-15')], at('2026-10-15')).toISOString().slice(0, 10)).toBe('2026-11-15');
  });
});
