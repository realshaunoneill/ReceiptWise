import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayOfWeek,
  daysBetween,
  easterSunday,
  formatLocalDate,
  fromUtcDate,
  irishBankHolidays,
  isBankHoliday,
  isLocalDate,
  localToday,
  nextBusinessDay,
  previousBusinessDay,
  toUtcDate,
} from './local-date';

describe('local dates', () => {
  it('validates real calendar days only', () => {
    expect(isLocalDate('2026-10-23')).toBe(true);
    expect(isLocalDate('2028-02-29')).toBe(true);
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2026-13-01')).toBe(false);
    expect(isLocalDate('2026-1-01')).toBe(false);
    expect(isLocalDate(20261023)).toBe(false);
  });

  it('reads the old midnight-UTC timestamps as their UTC day', () => {
    expect(fromUtcDate(new Date('2026-11-01T00:00:00.000Z'))).toBe('2026-11-01');
    expect(toUtcDate('2026-11-01').toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-23', '2026-10-25')).toBe(2);
    expect(daysBetween('2026-10-25', '2026-10-23')).toBe(-2);
  });

  it('moves weekend days to the nearest business day in the right direction', () => {
    // 2026-10-24 is a Saturday, 2026-10-25 a Sunday.
    expect(dayOfWeek('2026-10-24')).toBe(6);
    expect(previousBusinessDay('2026-10-25')).toBe('2026-10-23');
    expect(previousBusinessDay('2026-10-24')).toBe('2026-10-23');
    expect(nextBusinessDay('2026-10-17')).toBe('2026-10-19');
    expect(nextBusinessDay('2026-10-23')).toBe('2026-10-23');
  });

  it('skips Irish bank holidays too', () => {
    // Christmas 2026 is a Friday: pay due that day comes on the 24th. St Stephen's Day is the
    // Saturday, so the Monday after is the day off, and a direct debit waits until Tuesday.
    expect(previousBusinessDay('2026-12-25')).toBe('2026-12-24');
    expect(nextBusinessDay('2026-12-25')).toBe('2026-12-29');
    // The last Monday of October: a Saturday direct debit is collected on the Tuesday.
    expect(nextBusinessDay('2026-10-24')).toBe('2026-10-27');
    // St Patrick's Day 2027 is a Wednesday.
    expect(previousBusinessDay('2027-03-17')).toBe('2027-03-16');
    expect(nextBusinessDay('2027-03-17')).toBe('2027-03-18');
    // Easter Monday 2027.
    expect(isBankHoliday('2027-03-29')).toBe(true);
    expect(nextBusinessDay('2027-03-27')).toBe('2027-03-30');
    expect(previousBusinessDay('2027-03-29')).toBe('2027-03-26');
  });

  it('knows the Irish public holidays and their substitute days', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
    expect(easterSunday(2038)).toBe('2038-04-25');
    expect([...irishBankHolidays(2026)].sort()).toEqual([
      '2026-01-01', '2026-02-02', '2026-03-17', '2026-04-06', '2026-05-04', '2026-06-01',
      '2026-08-03', '2026-10-26', '2026-12-25', '2026-12-26', '2026-12-28',
    ]);
    // St Brigid's Day is 1 February when that is a Friday, else the first Monday.
    expect(isBankHoliday('2030-02-01')).toBe(true);
    expect(isBankHoliday('2030-02-04')).toBe(false);
    expect(isBankHoliday('2027-02-01')).toBe(true);
    // Weekend holidays move to the next free weekday: Christmas on a Saturday (2027) to the
    // Monday, St Stephen's on the Sunday to the Tuesday; Christmas on a Sunday (2033) to the
    // Tuesday, after St Stephen's Monday.
    expect(['2027-12-27', '2027-12-28'].every(isBankHoliday)).toBe(true);
    expect(['2033-12-26', '2033-12-27'].every(isBankHoliday)).toBe(true);
    expect(isBankHoliday('2028-01-03')).toBe(true); // New Year's Day on a Saturday
    expect(isBankHoliday('2030-03-18')).toBe(true); // St Patrick's Day on a Sunday
    expect(isBankHoliday('2026-12-24')).toBe(false);
  });

  it('takes today from the local clock and formats without shifting the day', () => {
    expect(localToday(new Date(2026, 9, 23, 23, 30))).toBe('2026-10-23');
    expect(formatLocalDate('2026-11-01', { day: 'numeric', month: 'short' }, 'en-IE')).toBe('1 Nov');
  });
});
