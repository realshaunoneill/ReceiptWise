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

function ymd(year: number, month: number, day: number): LocalDate {
  return fromUtcDate(new Date(Date.UTC(year, month - 1, day)));
}

/** The `nth` (1-based; -1 = last) given weekday of a month, `month` 1-based. */
function nthWeekday(year: number, month: number, weekday: number, nth: number): LocalDate {
  if (nth > 0) {
    const first = ymd(year, month, 1);
    return addDays(first, ((weekday - dayOfWeek(first) + 7) % 7) + (nth - 1) * 7);
  }
  const last = ymd(year, month, daysInMonth(year, month - 1));
  return addDays(last, -((dayOfWeek(last) - weekday + 7) % 7));
}

/** Easter Sunday, by the Anonymous Gregorian algorithm (Meeus/Jones/Butcher). */
export function easterSunday(year: number): LocalDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(year, month, day);
}

const holidayCache = new Map<number, Set<LocalDate>>();

/**
 * Irish public holidays in a year, with the substitute days banks close on. Ireland only for
 * now: every user so far is in Ireland, and payroll and direct debits here move off these days.
 * A user elsewhere would need their own country's list (and a setting to pick it).
 *
 * A fixed-date holiday on a weekend is taken on the next weekday that isn't already a holiday:
 * Christmas on a Saturday moves to Monday the 27th, and St Stephen's Day on the Sunday to the 28th.
 */
export function irishBankHolidays(year: number): Set<LocalDate> {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const brigid = ymd(year, 2, 1);
  const fixed = [ymd(year, 1, 1), ymd(year, 3, 17), ymd(year, 12, 25), ymd(year, 12, 26)];
  const days = new Set<LocalDate>([
    ...fixed,
    // St Brigid's Day: the first Monday of February, or 1 February itself when that is a Friday.
    dayOfWeek(brigid) === 5 ? brigid : nthWeekday(year, 2, 1, 1),
    addDays(easterSunday(year), 1), // Easter Monday
    nthWeekday(year, 5, 1, 1),
    nthWeekday(year, 6, 1, 1),
    nthWeekday(year, 8, 1, 1),
    nthWeekday(year, 10, 1, -1),
  ]);
  for (const holiday of fixed) {
    if (!isWeekend(holiday)) continue;
    let substitute = addDays(holiday, 1);
    while (isWeekend(substitute) || days.has(substitute)) substitute = addDays(substitute, 1);
    days.add(substitute);
  }

  holidayCache.set(year, days);
  return days;
}

/** A bank holiday in Ireland (see irishBankHolidays), including a substitute day for a weekend one. */
export function isBankHoliday(day: LocalDate): boolean {
  return irishBankHolidays(Number(day.slice(0, 4))).has(day);
}

/** A weekday that isn't a bank holiday: a day banks pay salaries and collect direct debits on. */
export function isBusinessDay(day: LocalDate): boolean {
  return !isWeekend(day) && !isBankHoliday(day);
}

/**
 * `day` itself if it is a business day, otherwise the next one: a direct debit due on Saturday
 * 24 October 2026 is collected on Tuesday the 27th, as the Monday is a bank holiday.
 */
export function nextBusinessDay(day: LocalDate): LocalDate {
  let result = day;
  while (!isBusinessDay(result)) result = addDays(result, 1);
  return result;
}

/**
 * `day` itself if it is a business day, otherwise the one before: pay due on Christmas Day is
 * paid on the 24th.
 */
export function previousBusinessDay(day: LocalDate): LocalDate {
  let result = day;
  while (!isBusinessDay(result)) result = addDays(result, -1);
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
