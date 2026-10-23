/**
 * Calendar days as `YYYY-MM-DD` strings.
 *
 * Bills, paydays and balances are about calendar days, not instants. The older tables store them
 * as `timestamp` columns holding midnight UTC, and the UI used to format those in the browser's
 * time zone, so anyone west of UTC saw every date a day early. Newer columns use Postgres `date`,
 * which Drizzle returns as this same string. Do date maths on these strings (via UTC Dates
 * internally) and only format for display at the edge.
 */

export type LocalDate = string;

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== 'string') return false;
  const match = LOCAL_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m - 1);
}

/** Days in a month, `month` zero-based like Date. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Midnight UTC of a calendar day. */
export function toUtcDate(day: LocalDate): Date {
  const match = LOCAL_DATE.exec(day);
  if (!match) throw new Error(`Not a YYYY-MM-DD date: ${day}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/** The UTC calendar day of an instant: the right reading of the old midnight-UTC timestamp columns. */
export function fromUtcDate(date: Date): LocalDate {
  return date.toISOString().slice(0, 10);
}

/** The calendar day of an instant in the runtime's own time zone (the browser's, on the client). */
export function localToday(now: Date = new Date()): LocalDate {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export function addDays(day: LocalDate, days: number): LocalDate {
  return fromUtcDate(new Date(toUtcDate(day).getTime() + days * DAY_MS));
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(day: LocalDate): number {
  return toUtcDate(day).getUTCDay();
}

export function isWeekend(day: LocalDate): boolean {
  const weekday = dayOfWeek(day);
  return weekday === 0 || weekday === 6;
}

/** `day` itself if it is a weekday, otherwise the Monday after. */
export function nextBusinessDay(day: LocalDate): LocalDate {
  let result = day;
  while (isWeekend(result)) result = addDays(result, 1);
  return result;
}

/** `day` itself if it is a weekday, otherwise the Friday before. */
export function previousBusinessDay(day: LocalDate): LocalDate {
  let result = day;
  while (isWeekend(result)) result = addDays(result, -1);
  return result;
}

/** Lexical order is date order for YYYY-MM-DD. */
export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Format for display without going through the browser's time zone. */
export function formatLocalDate(
  day: LocalDate,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
  locale?: string,
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(toUtcDate(day));
}
