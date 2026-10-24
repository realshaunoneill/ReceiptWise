import { describe, expect, it } from 'vitest';
import { topMerchantsFor } from './use-item-analysis';

describe('topMerchantsFor', () => {
  it('adds up purchases and spend per merchant across item variants', () => {
    const merchants = topMerchantsFor([
      { merchantBreakdown: [{ merchant: 'Tesco', count: 3, total: 7.5 }, { merchant: 'Lidl', count: 1, total: 2.1 }] },
      { merchantBreakdown: [{ merchant: 'Tesco', count: 1, total: 2.8 }] },
    ]);

    expect(merchants).toEqual([
      { merchant: 'Tesco', count: 4, total: 10.3, average: 2.58 },
      { merchant: 'Lidl', count: 1, total: 2.1, average: 2.1 },
    ]);
  });

  it('breaks a tie on purchases by spend', () => {
    const merchants = topMerchantsFor([
      { merchantBreakdown: [{ merchant: 'Aldi', count: 2, total: 3 }, { merchant: 'Spar', count: 2, total: 5 }] },
    ]);

    expect(merchants.map((m) => m.merchant)).toEqual(['Spar', 'Aldi']);
  });

  it('is empty when the items carry no breakdown', () => {
    expect(topMerchantsFor([{}, { merchantBreakdown: [] }])).toEqual([]);
  });
});
