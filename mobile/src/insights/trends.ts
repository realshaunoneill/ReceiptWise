import { addDays, daysBetween, formatLocalDate, type LocalDate } from '@shared/dates/local-date';

/**
 * The spending summary's arithmetic (the website's lib/hooks/use-spending-trends.ts), from the
 * per-receipt points /api/receipts/stats returns. The same periods: the week is the last 7 days,
 * the month runs from the 1st, the year from 1 January, each up to today; the change compares
 * with the same number of days just before. In local calendar days, labelled in en-IE.
 */

export type TrendPeriod = 'week' | 'month' | 'year';
export type Point = { date: string; amount: number; category: string | null };
export type Bar = { key: string; label: string; amount: number };

export type Trends = {
  total: number;
  /** Percent against the period before; 0 when there was nothing then. */
  change: number;
  byCategory: Array<{ category: string; amount: number; percentage: number }>;
  bars: Bar[];
};

/** The period's first day, and the first day of the one before it (what ?from= asks for). */
export function periodBounds(period: TrendPeriod, today: LocalDate): { start: LocalDate; previousStart: LocalDate } {
  const start = period === 'week' ? addDays(today, -6) : period === 'month' ? `${today.slice(0, 8)}01` : `${today.slice(0, 4)}-01-01`;
  const length = daysBetween(start, today) + 1;
  return { start, previousStart: addDays(start, -length) };
}

const MONTH_LABEL = (day: LocalDate) => formatLocalDate(day, { month: 'short' }, 'en-IE');
const DAY_OF = (day: LocalDate) => Number(day.slice(8, 10));

/** The bars: a day each for the week, 7-day runs from the 1st for the month, a month each for the year. */
function bucketsFor(period: TrendPeriod, start: LocalDate, today: LocalDate): Bar[] {
  const bars: Bar[] = [];
  if (period === 'week') {
    for (let day = start; day <= today; day = addDays(day, 1)) {
      bars.push({ key: day, label: formatLocalDate(day, { weekday: 'short' }, 'en-IE'), amount: 0 });
    }
  } else if (period === 'month') {
    for (let day = start; day <= today; day = addDays(day, 7)) {
      const last = addDays(day, 6) < today ? addDays(day, 6) : today;
      bars.push({ key: day, label: day === last ? `${DAY_OF(day)}` : `${DAY_OF(day)}–${DAY_OF(last)}`, amount: 0 });
    }
  } else {
    for (let month = 1; month <= Number(today.slice(5, 7)); month++) {
      const key = `${today.slice(0, 4)}-${String(month).padStart(2, '0')}-01`;
      bars.push({ key, label: MONTH_LABEL(key), amount: 0 });
    }
  }
  return bars;
}

function barFor(period: TrendPeriod, bars: Bar[], day: LocalDate): Bar | undefined {
  if (period === 'year') return bars.find((bar) => bar.key.slice(0, 7) === day.slice(0, 7));
  if (period === 'week') return bars.find((bar) => bar.key === day);
  // The last 7-day run that starts on or before the day.
  return [...bars].reverse().find((bar) => bar.key <= day);
}

export function spendingTrends(points: Point[], period: TrendPeriod, today: LocalDate): Trends {
  const { start, previousStart } = periodBounds(period, today);
  const bars = bucketsFor(period, start, today);
  const categories = new Map<string, number>();
  let total = 0;
  let previous = 0;

  for (const point of points) {
    const day = point.date.slice(0, 10);
    if (day > today || day < previousStart) continue;
    if (day < start) {
      previous += point.amount;
      continue;
    }
    total += point.amount;
    const bar = barFor(period, bars, day);
    if (bar) bar.amount += point.amount;
    const category = point.category || 'other';
    categories.set(category, (categories.get(category) ?? 0) + point.amount);
  }

  const byCategory = Array.from(categories, ([category, amount]) => ({ category, amount, percentage: total > 0 ? Math.round((amount / total) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);
  const change = previous > 0 ? Math.round(((total - previous) / previous) * 100) : 0;
  return { total, change, byCategory, bars };
}

/** What a screen reader hears for the chart: the total, the change, and the biggest bar. */
export function describeTrends(trends: Trends, period: TrendPeriod, format: (amount: number) => string): string {
  const when = period === 'week' ? 'in the last 7 days' : period === 'month' ? 'this month' : 'this year';
  const change = trends.change === 0 ? '' : `, ${trends.change > 0 ? 'up' : 'down'} ${Math.abs(trends.change)}% on the period before`;
  const top = trends.bars.reduce<Bar | null>((best, bar) => (bar.amount > (best?.amount ?? 0) ? bar : best), null);
  const peak = top ? `. Most was ${top.label}, ${format(top.amount)}` : '';
  return `${format(trends.total)} spent ${when}${change}${peak}.`;
}
