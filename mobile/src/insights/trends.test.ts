import { describe, expect, it } from 'vitest';
import { describeTrends, periodBounds, spendingTrends } from './trends';

const point = (date: string, amount: number, category: string | null = 'groceries') => ({ date, amount, category });

describe('spending trends', () => {
  it('uses the website periods, each compared with the same length just before', () => {
    expect(periodBounds('week', '2026-10-26')).toEqual({ start: '2026-10-20', previousStart: '2026-10-13' });
    expect(periodBounds('month', '2026-10-26')).toEqual({ start: '2026-10-01', previousStart: '2026-09-05' });
    expect(periodBounds('year', '2026-01-10')).toEqual({ start: '2026-01-01', previousStart: '2025-12-22' });
  });

  it('totals the period, its categories and the change on the period before', () => {
    const trends = spendingTrends(
      [point('2026-10-02', 30), point('2026-10-20', 10, 'dining'), point('2026-09-20', 20), point('2026-08-01', 999), point('2026-10-27', 50)],
      'month',
      '2026-10-26',
    );
    expect(trends.total).toBe(40);
    expect(trends.change).toBe(100);
    expect(trends.byCategory).toEqual([{ category: 'groceries', amount: 30, percentage: 75 }, { category: 'dining', amount: 10, percentage: 25 }]);
  });

  it('draws a bar per day, per 7 days from the 1st, or per month', () => {
    expect(spendingTrends([], 'week', '2026-10-26').bars.map((bar) => bar.label)).toEqual(['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon']);
    const month = spendingTrends([point('2026-10-09', 5), point('2026-10-15', 7)], 'month', '2026-10-26');
    expect(month.bars).toEqual([
      { key: '2026-10-01', label: '1–7', amount: 0 },
      { key: '2026-10-08', label: '8–14', amount: 5 },
      { key: '2026-10-15', label: '15–21', amount: 7 },
      { key: '2026-10-22', label: '22–26', amount: 0 },
    ]);
    expect(spendingTrends([point('2026-02-03', 4)], 'year', '2026-03-01').bars).toEqual([
      { key: '2026-01-01', label: 'Jan', amount: 0 },
      { key: '2026-02-01', label: 'Feb', amount: 4 },
      { key: '2026-03-01', label: 'Mar', amount: 0 },
    ]);
  });

  it('says it in words for a screen reader', () => {
    const trends = spendingTrends([point('2026-10-09', 5), point('2026-09-25', 10)], 'month', '2026-10-26');
    expect(describeTrends(trends, 'month', (amount) => `€${amount}`)).toBe('€5 spent this month, down 50% on the period before. Most was 8–14, €5.');
  });
});
