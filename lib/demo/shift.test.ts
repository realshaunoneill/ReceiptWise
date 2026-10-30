import { describe, expect, it } from 'vitest';
import { demoMonthShift, shiftDates } from './shift';

describe('demoMonthShift', () => {
  it('keeps the captured period when today is in it', () => {
    expect(demoMonthShift('2026-10-30', new Date('2026-10-30T10:00:00Z'))).toBe(0);
    expect(demoMonthShift('2026-10-30', new Date('2026-11-20T10:00:00Z'))).toBe(0);
  });

  it('moves on a month at each payday', () => {
    expect(demoMonthShift('2026-10-30', new Date('2026-11-23T10:00:00Z'))).toBe(1);
    expect(demoMonthShift('2026-10-30', new Date('2026-12-10T10:00:00Z'))).toBe(1);
    expect(demoMonthShift('2026-10-30', new Date('2027-03-01T10:00:00Z'))).toBe(4);
  });
});

describe('shiftDates', () => {
  it('moves dates, timestamps and month labels, deep in the data', () => {
    const data = { period: { start: '2026-10-23', end: '2026-11-25', label: 'November 2026' }, lines: [{ dueDate: '2026-11-01', at: '2026-10-24T00:30:23.965Z' }], amount: 12.5 };
    expect(shiftDates(data, 2)).toEqual({ period: { start: '2026-12-23', end: '2027-01-25', label: 'January 2027' }, lines: [{ dueDate: '2027-01-01', at: '2026-12-24T00:30:23.965Z' }], amount: 12.5 });
  });

  it('keeps a day that a shorter month lacks inside that month', () => {
    expect(shiftDates('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('leaves other text alone', () => {
    expect(shiftDates({ name: 'Rent', note: 'May the 4th', label: 'Coming in' }, 3)).toEqual({ name: 'Rent', note: 'May the 4th', label: 'Coming in' });
  });
});
