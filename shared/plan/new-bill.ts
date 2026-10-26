import { addDays, daysInMonth, type LocalDate } from '../dates/local-date';
import { inBucket, type Period } from '../schedule/pay-schedule';

/**
 * The start date for a new monthly bill on `day` of the month, added while planning `period`: its
 * occurrence in that period, so the bill shows on the sheet being filled in (rent on the 1st,
 * added on the 10th, is still November's rent). Without one in the period (a short weekly pay
 * period), the next one after it starts.
 */
export function firstBillDate(period: Period, day: number): LocalDate {
  const wanted = Math.min(Math.max(Math.round(day) || 1, 1), 31);
  const from = period.bucket.start < period.start ? period.bucket.start : period.start;
  let fallback: LocalDate | null = null;
  for (let date = from, i = 0; i < 70; date = addDays(date, 1), i++) {
    const [year, month, dayOfMonth] = date.split('-').map(Number);
    if (dayOfMonth !== Math.min(wanted, daysInMonth(year, month - 1))) continue;
    if (inBucket(period, date, wanted)) return date;
    if (!fallback && date >= period.end) fallback = date;
  }
  return fallback ?? period.start;
}
