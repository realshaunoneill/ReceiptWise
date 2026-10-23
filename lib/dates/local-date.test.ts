import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayOfWeek,
  daysBetween,
  formatLocalDate,
  fromUtcDate,
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
    expect(nextBusinessDay('2026-10-24')).toBe('2026-10-26');
    expect(nextBusinessDay('2026-10-23')).toBe('2026-10-23');
  });

  it('takes today from the local clock and formats without shifting the day', () => {
    expect(localToday(new Date(2026, 9, 23, 23, 30))).toBe('2026-10-23');
    expect(formatLocalDate('2026-11-01', { day: 'numeric', month: 'short' }, 'en-IE')).toBe('1 Nov');
  });
});
