import { describe, expect, it } from 'vitest';
import { billRequests, BILL_PICKS, incomeRequest, payProblem, typedCents } from './setup';

const period = { label: 'November 2026', start: '2026-10-23', end: '2026-11-25', weeks: 4.7, calendarMonth: false, bucket: { start: '2026-10-23', end: '2026-11-25' } } as never;

describe('plan setup', () => {
  it('reads amounts as people type them', () => {
    expect(typedCents('3,820')).toBe(382000);
    expect(typedCents('€1,450.00')).toBe(145000);
    expect(typedCents('12,50')).toBe(1250);
    expect(typedCents('')).toBeNull();
  });

  it('says what is wrong with the pay', () => {
    expect(payProblem({ amount: '', frequency: 'monthly', payDay: 25 })).toBe('Enter what you get paid');
    expect(payProblem({ amount: '3820', frequency: 'monthly', payDay: null })).toBe('Pick a payday from 1 to 31');
    expect(payProblem({ amount: '900', frequency: 'fortnightly' })).toBe('Pick a day you were paid');
    expect(payProblem({ amount: '3,820.00', frequency: 'monthly', payDay: 25 })).toBeNull();
  });

  it('makes the pay the main income', () => {
    expect(incomeRequest({ amount: '3,820', frequency: 'monthly', payDay: 25 }, 'EUR')).toMatchObject({ amount: '3820.00', payDay: 25, anchorDate: null, isPrimary: true, frequency: 'monthly' });
    expect(incomeRequest({ amount: '900', frequency: 'weekly', anchorDate: '2026-10-23', payDay: 5 }, 'EUR')).toMatchObject({ payDay: null, anchorDate: '2026-10-23' });
  });

  it('adds the picked bills as essential monthly bills, the way each is usually paid', () => {
    const requests = billRequests([
      { key: 'home', label: 'Rent or mortgage', amount: '1450' },
      { key: 'card', label: 'Credit card', amount: '547.12', day: 20 },
      { key: 'phone', label: 'Phone', amount: '' },
    ], period, 'EUR');
    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({ name: 'Rent or mortgage', kind: 'bill', billingDay: 1, paymentMethod: 'standing_order', category: 'Housing', billingFrequency: 'monthly' });
    expect(requests[1]).toMatchObject({ kind: 'bill', billingDay: 20, paymentMethod: 'manual', amountType: 'variable' });
    // In the period on screen: rent on 1 Nov, the card on 20 Nov.
    expect(requests[0].startDate).toBe('2026-11-01');
    expect(requests[1].startDate).toBe('2026-11-20');
  });

  it('offers only essential bills', () => {
    expect(BILL_PICKS.every((pick) => !['Streaming', 'Entertainment', 'Music', 'Fitness'].includes(pick.category))).toBe(true);
  });
});
