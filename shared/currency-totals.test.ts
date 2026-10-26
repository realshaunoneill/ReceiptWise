import { describe, expect, it } from 'vitest';
import { formatTotals, totalsByCurrency } from './currency-totals';

describe('totalsByCurrency', () => {
  it('keeps each currency separate, the preferred one first', () => {
    const totals = totalsByCurrency([
      { amount: '10.00', currency: 'USD' },
      { amount: '0.10', currency: 'EUR' },
      { amount: 0.2, currency: 'EUR' },
      { amount: '5', currency: null },
      { amount: 'not a number', currency: 'EUR' },
    ], 'EUR');
    expect(totals).toEqual([{ currency: 'EUR', amount: 5.3 }, { currency: 'USD', amount: 10 }]);
  });

  it('formats one or several currencies', () => {
    expect(formatTotals([], 'EUR')).toBe(formatTotals([{ currency: 'EUR', amount: 0 }], 'EUR'));
    expect(formatTotals([{ currency: 'EUR', amount: 1 }, { currency: 'USD', amount: 2 }], 'EUR')).toContain(' + ');
  });
});
