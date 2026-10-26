import { describe, expect, it } from 'vitest';
import { type WireTopItem } from '@shared/api/insights';
import { analyseItem, matchItems } from './items';

const item = (name: string, count: number, totalSpent: number, merchants: Array<[string, number, number]>): WireTopItem => ({
  name, count, totalSpent, totalQuantity: count, averagePrice: totalSpent / count, category: 'groceries',
  merchantCount: merchants.length, merchants: merchants.map(([merchant]) => merchant),
  merchantBreakdown: merchants.map(([merchant, times, total]) => ({ merchant, count: times, total })), lastPurchased: '2026-10-20', currency: 'EUR',
});

const items = [item('Milk', 4, 6, [['Tesco', 3, 4.5], ['Lidl', 1, 1.5]]), item('Milk 2L', 2, 5, [['Tesco', 2, 5]]), item('Bread', 1, 2, [['Aldi', 1, 2]])];

describe('item analysis', () => {
  it('matches the name exactly first, then by its words', () => {
    expect(matchItems('milk', items).map((match) => match.name)).toEqual(['Milk']);
    // As on the website, a name inside the search counts too: "2l milk" contains "milk".
    expect(matchItems('2l milk', items).map((match) => match.name)).toEqual(['Milk', 'Milk 2L']);
    expect(matchItems('cheese', items)).toEqual([]);
  });

  it('adds up every kind, and each merchant across them', () => {
    const analysis = analyseItem('mil', items, [], 'EUR')!;
    expect(analysis.title).toBe('mil (2 kinds)');
    expect(analysis.totals).toEqual({ purchases: 6, spent: 11, quantity: 6, averagePrice: 1.83, currency: 'EUR' });
    expect(analysis.merchants).toEqual([{ merchant: 'Tesco', count: 5, total: 9.5, average: 1.9 }, { merchant: 'Lidl', count: 1, total: 1.5, average: 1.5 }]);
  });

  it('says nothing matched rather than inventing a purchase', () => {
    expect(analyseItem('cheese', items, [], 'EUR')).toBeNull();
  });
});
