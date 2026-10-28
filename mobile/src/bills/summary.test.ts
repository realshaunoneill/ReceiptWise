import { describe, expect, it } from 'vitest';
import { dueLabel, filterBills, monthlyTotals, notMarkedPaid, paymentDay, type ListedBill } from './summary';

const bill = (overrides: Partial<ListedBill>): ListedBill => ({
  id: 'b', userId: 'u', householdId: null, name: 'Rent', description: null, category: null, amount: '100.00', currency: 'EUR',
  billingFrequency: 'monthly', billingDay: 1, customFrequencyDays: null, status: 'active', kind: 'bill', amountType: 'fixed',
  paymentMethod: null, startDate: '2026-01-01T00:00:00.000Z', endDate: null, nextBillingDate: '2026-11-01T00:00:00.000Z',
  lastPaymentDate: null, website: null, notes: null, isBusinessExpense: false, ...overrides,
});

describe('bills summary', () => {
  it('totals a month per currency, never adding euro to dollars', () => {
    const totals = monthlyTotals([
      bill({ amount: '120.00', billingFrequency: 'yearly' }),
      bill({ amount: '30.00', billingFrequency: 'quarterly' }),
      bill({ amount: '10.00', currency: 'USD' }),
      bill({ amount: '50.00', billingFrequency: 'once' }),
    ], 'EUR');
    expect(totals).toEqual([{ currency: 'EUR', amount: 20 }, { currency: 'USD', amount: 10 }]);
  });

  it("counts a variable bill at this month's own amount when it has one", () => {
    expect(monthlyTotals([bill({ amount: '0.00', amountType: 'variable', nextAmount: '809.00' })], 'EUR')).toEqual([{ currency: 'EUR', amount: 809 }]);
  });

  it('narrows to a kind, and to those not marked paid', () => {
    const bills = [bill({ id: 'a', kind: 'bill', missingPayments: 2 }), bill({ id: 'b', kind: 'subscription' }), bill({ id: 'c', kind: 'subscription', missingPayments: 1 })];
    expect(filterBills(bills, 'subscription', false).map((b) => b.id)).toEqual(['b', 'c']);
    expect(filterBills(bills, 'all', true).map((b) => b.id)).toEqual(['a', 'c']);
    expect(notMarkedPaid(bills)).toBe(3);
  });

  it("dates an occurrence by the bill's own due date when it has one", () => {
    expect(paymentDay({ dueDate: '2026-11-12', expectedDate: '2026-11-14T00:00:00.000Z' })).toBe('2026-11-12');
    expect(paymentDay({ dueDate: null, expectedDate: '2026-11-14T00:00:00.000Z' })).toBe('2026-11-14');
  });

  it('says when it is due in plain words', () => {
    expect(dueLabel('2026-10-26', '2026-10-26')).toBe('Due today');
    expect(dueLabel('2026-10-27', '2026-10-26')).toBe('Due tomorrow');
    expect(dueLabel('2026-10-29', '2026-10-26')).toBe('Due in 3 days');
    expect(dueLabel('2026-11-12', '2026-10-26')).toBe('Due 12 Nov');
    expect(dueLabel('2026-10-20', '2026-10-26')).toBe('Was due 20 Oct');
    expect(dueLabel('2026-10-26', '2026-10-26', 'direct_debit')).toBe('Goes out today');
  });
});
