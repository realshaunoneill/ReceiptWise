import { describe, expect, it } from 'vitest';
import { latestReceiptDay, monthStart, nothingSpentLine, quickStatTiles } from './quick-stats';

const money = (amount: number) => `€${amount.toFixed(2)}`;

describe('quickStatTiles', () => {
  it('names each figure for what it is, with this month beside the count', () => {
    const tiles = quickStatTiles({ totalReceipts: 1234, avgSpending: 49.07, spendingByCategory: [{ category: 'groceries' }] }, 3, money);
    expect(tiles.map((tile) => [tile.label, tile.value, tile.detail])).toEqual([
      ['Receipts', '1,234', '3 this month'],
      ['Average receipt', '€49.07', 'Per receipt'],
      ['Top category', 'Groceries', 'Most spent'],
    ]);
  });

  it('says none this month, and none yet with no categories', () => {
    const tiles = quickStatTiles({ totalReceipts: 2, avgSpending: 0, spendingByCategory: [] }, 0, money);
    expect(tiles[0].detail).toBe('None this month');
    expect(tiles[2].value).toBe('None yet');
    expect(quickStatTiles({ totalReceipts: 2, avgSpending: 0, spendingByCategory: [] }, null, money)[0].detail).toBe('All time');
  });
});

describe('the empty spending line', () => {
  it('says when the last receipt was, with the year only if it was another year', () => {
    expect(nothingSpentLine('month', '2026-01-07', '2026-10-28')).toBe('Nothing this month yet. Your last receipt was 7 Jan.');
    expect(nothingSpentLine('week', '2025-12-20', '2026-10-28')).toBe('Nothing in the last 7 days. Your last receipt was 20 Dec 2025.');
    expect(nothingSpentLine('year', null, '2026-10-28')).toBe('Nothing this year yet.');
  });

  it('takes the newest receipt date, or the day added when none was read', () => {
    expect(latestReceiptDay([
      { transactionDate: '2026-01-07', createdAt: '2026-10-20T10:00:00Z' },
      { transactionDate: null, createdAt: '2026-02-03T10:00:00Z' },
      { transactionDate: '2025-05-15' },
    ])).toBe('2026-02-03');
    expect(latestReceiptDay([])).toBeNull();
  });

  it('starts the month on the 1st', () => {
    expect(monthStart('2026-10-28')).toBe('2026-10-01');
  });
});
