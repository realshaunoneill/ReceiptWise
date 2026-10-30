/**
 * The demo's figures were captured on one day (lib/demo/fixture.json, capturedOn). To always show
 * this month, every date in them moves on by whole months: the pay period that held the capture
 * day becomes the one that holds today. Pure, so it's tested.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The demo household is paid on the 25th, and its periods start from the 23rd at the earliest. */
const PERIOD_START_DAY = 23;

/** Which pay month a day is in: the month it falls in from the 23rd, else the month before. */
function payMonth(date: Date): number {
  const month = date.getUTCFullYear() * 12 + date.getUTCMonth();
  return date.getUTCDate() >= PERIOD_START_DAY ? month : month - 1;
}

/** Whole months to move the captured figures on by, so their current period holds `now`. */
export function demoMonthShift(capturedOn: string, now: Date): number {
  return payMonth(now) - payMonth(new Date(`${capturedOn}T12:00:00Z`));
}

function shiftDateString(value: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(.*)$/.exec(value);
  if (match) {
    const total = Number(match[1]) * 12 + Number(match[2]) - 1 + months;
    const year = Math.floor(total / 12);
    const month = total - year * 12;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(Number(match[3]), lastDay);
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}${match[4]}`;
  }
  const label = /^([A-Z][a-z]+) (\d{4})$/.exec(value);
  if (label && MONTHS.includes(label[1])) {
    const total = Number(label[2]) * 12 + MONTHS.indexOf(label[1]) + months;
    return `${MONTHS[((total % 12) + 12) % 12]} ${Math.floor(total / 12)}`;
  }
  return value;
}

/** A copy of `value` with every date ("2026-10-23", ISO timestamps) and "November 2026" moved on. */
export function shiftDates<T>(value: T, months: number): T {
  if (months === 0) return value;
  if (typeof value === 'string') return shiftDateString(value, months) as T;
  if (Array.isArray(value)) return value.map((item) => shiftDates(item, months)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shiftDates(item, months)])) as T;
  }
  return value;
}
