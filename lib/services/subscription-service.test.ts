import { describe, expect, it } from 'vitest';
import { collectionDay, SubscriptionService } from './subscription-service';

const at = (day: string) => new Date(`${day}T00:00:00.000Z`);

describe('collectionDay', () => {
  it('uses the due date when a bill gave one, else the cycle date', () => {
    expect(collectionDay({ dueDate: '2026-11-03', expectedDate: at('2026-11-01') })).toBe('2026-11-03');
    expect(collectionDay({ dueDate: null, expectedDate: at('2026-11-02') })).toBe('2026-11-02');
  });

  it('moves a weekend collection to the next business day', () => {
    // 2026-10-17 is a Saturday. 2026-10-24 is too, and the Monday after is a bank holiday.
    expect(collectionDay({ dueDate: null, expectedDate: at('2026-10-17') })).toBe('2026-10-19');
    expect(collectionDay({ dueDate: null, expectedDate: at('2026-10-24') })).toBe('2026-10-27');
  });

  it('charges a card on the day itself, weekend or not', () => {
    expect(collectionDay({ dueDate: null, expectedDate: at('2026-10-24') }, 'card')).toBe('2026-10-24');
    expect(collectionDay({ dueDate: null, expectedDate: at('2026-10-24') }, 'standing_order')).toBe('2026-10-27');
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

  it('never counts a direct debit, standing order or card payment as overdue', () => {
    const old = { status: 'pending', dueDate: null, expectedDate: at('2026-09-01') };
    expect(SubscriptionService.isOverdue(old, now, 'direct_debit')).toBe(false);
    expect(SubscriptionService.isOverdue(old, now, 'standing_order')).toBe(false);
    expect(SubscriptionService.isOverdue(old, now, 'card')).toBe(false);
    expect(SubscriptionService.isOverdue(old, now, 'manual')).toBe(true);
    expect(SubscriptionService.isOverdue(old, now, null)).toBe(true);
  });

  it('does not count a card charge the daily job marked missed before cards were automatic', () => {
    const missed = { status: 'missed', dueDate: null, expectedDate: at('2026-10-03') };
    expect(SubscriptionService.isOverdue(missed, now, 'card')).toBe(false);
    expect(SubscriptionService.isOverdue(missed, now, 'manual')).toBe(true);
  });
});

describe('SubscriptionService.sortDueRows', () => {
  const now = at('2026-10-23');
  const row = (method: string | null, status: string, day: string) =>
    ({ paymentMethod: method, payment: { status, dueDate: null, expectedDate: at(day) } });

  it('assumes automatic payments paid once collected, and marks manual ones missed after the grace period', () => {
    const rows = [
      row('direct_debit', 'pending', '2026-10-20'),
      row('card', 'pending', '2026-10-23'),
      row('direct_debit', 'pending', '2026-10-24'), // not collected yet
      row('manual', 'pending', '2026-10-19'),
      row(null, 'pending', '2026-10-19'),
      row('manual', 'pending', '2026-10-21'), // still in the grace period
    ];
    const { assumed, missed } = SubscriptionService.sortDueRows(rows, now);
    expect(assumed).toEqual([rows[0], rows[1]]);
    expect(missed).toEqual([rows[3], rows[4]]);
  });

  it("clears the card charges it used to mark missed, but leaves a manual bill's missed row alone", () => {
    const rows = [row('card', 'missed', '2026-09-03'), row('manual', 'missed', '2026-09-03')];
    const { assumed, missed } = SubscriptionService.sortDueRows(rows, now);
    expect(assumed).toEqual([rows[0]]);
    expect(missed).toEqual([]);
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
