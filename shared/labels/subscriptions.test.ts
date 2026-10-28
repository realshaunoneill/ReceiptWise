import { describe, expect, it } from 'vitest';
import { nextPaymentAmount, nextPaymentLabel, paymentStatusLabel } from './subscriptions';

describe('nextPaymentAmount', () => {
  it("uses the cycle's own amount when one is set, even on a variable bill with a usual of 0", () => {
    expect(nextPaymentAmount({ amount: '0.00', amountType: 'variable', nextAmount: '809.00' })).toEqual({ amount: 809, estimated: false });
  });

  it('falls back to the usual amount, an estimate for a variable bill', () => {
    expect(nextPaymentAmount({ amount: '1400.00', amountType: 'variable', nextAmount: null })).toEqual({ amount: 1400, estimated: true });
    expect(nextPaymentAmount({ amount: '469.00', amountType: 'fixed' })).toEqual({ amount: 469, estimated: false });
  });
});

describe('nextPaymentLabel', () => {
  it('says a direct debit goes out, and is never urgent', () => {
    expect(nextPaymentLabel('2026-11-01', '2026-11-01', 'direct_debit')).toEqual({ label: 'Goes out today', urgency: 'later' });
    expect(nextPaymentLabel('2026-11-03', '2026-11-01', 'standing_order')).toEqual({ label: 'Goes out in 2 days', urgency: 'later' });
    expect(nextPaymentLabel('2026-11-20', '2026-11-01', 'card').label).toBe('Goes out 20 Nov');
  });

  it('says one paid by hand is due, and gets urgent as the day comes', () => {
    expect(nextPaymentLabel('2026-11-01', '2026-11-01', 'manual')).toEqual({ label: 'Due today', urgency: 'due' });
    expect(nextPaymentLabel('2026-11-02', '2026-11-01', null)).toEqual({ label: 'Due tomorrow', urgency: 'soon' });
    expect(nextPaymentLabel('2026-11-20', '2026-11-01', 'manual')).toEqual({ label: 'Due 20 Nov', urgency: 'later' });
    expect(nextPaymentLabel('2026-10-30', '2026-11-01', 'manual').label).toBe('Was due 30 Oct');
  });
});

describe('paymentStatusLabel', () => {
  it("calls a missed payment Overdue, the plan's word", () => {
    expect(paymentStatusLabel('missed')).toBe('Overdue');
  });
});
