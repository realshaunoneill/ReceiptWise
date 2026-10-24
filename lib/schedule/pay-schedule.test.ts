import { describe, expect, it } from 'vitest';
import { inBucket, paydaysBetween, paydaysDueAndPaid, periodAt, periodContaining, type PaySchedule } from './pay-schedule';

const monthly = (payDay: number, weekendRule = 'previous_business_day'): PaySchedule =>
  ({ frequency: 'monthly', payDay, anchorDate: null, weekendRule });

describe('paydaysBetween', () => {
  it('moves a weekend payday to the Friday before by default', () => {
    // 2026-10-25 is a Sunday, 2027-04-25 a Sunday too.
    expect(paydaysBetween(monthly(25), '2026-10-01', '2026-12-31')).toEqual(['2026-10-23', '2026-11-25', '2026-12-24']);
  });

  it('moves a payday off a bank holiday the same way', () => {
    // Christmas Day 2026 is a Friday: Irish payroll pays on the 24th.
    expect(paydaysBetween(monthly(25), '2026-12-01', '2027-01-01')).toEqual(['2026-12-24']);
    // St Patrick's Day 2027 is a Wednesday; Easter Monday 2027 is 29 March.
    expect(paydaysBetween(monthly(17), '2027-03-01', '2027-04-01')).toEqual(['2027-03-16']);
    expect(paydaysBetween(monthly(29, 'next_business_day'), '2027-03-10', '2027-04-10')).toEqual(['2027-03-30']);
  });

  it('can move it to the Monday after, or leave it', () => {
    // 26 October 2026 is a bank holiday (the last Monday of October), so the Tuesday.
    expect(paydaysBetween(monthly(25, 'next_business_day'), '2026-10-01', '2026-11-01')).toEqual(['2026-10-27']);
    expect(paydaysBetween(monthly(25, 'none'), '2026-10-01', '2026-11-01')).toEqual(['2026-10-25']);
  });

  it('clamps the 31st to short months', () => {
    expect(paydaysBetween(monthly(31, 'none'), '2027-02-01', '2027-05-01')).toEqual(['2027-02-28', '2027-03-31', '2027-04-30']);
  });

  it('includes a payday the weekend rule pulls into the range', () => {
    // 2027-05-01 is a Saturday, paid on Friday 2027-04-30.
    expect(paydaysBetween(monthly(1), '2027-04-01', '2027-05-01')).toEqual(['2027-04-01', '2027-04-30']);
  });

  it('uses the last weekday of the month for last_working_day', () => {
    // 2026-10-31 is a Saturday.
    expect(paydaysBetween({ frequency: 'last_working_day', payDay: null, anchorDate: null, weekendRule: 'none' }, '2026-10-01', '2026-12-01'))
      .toEqual(['2026-10-30', '2026-11-30']);
  });

  it('steps weekly kinds from the anchor, in both directions', () => {
    const fortnightly = { frequency: 'fortnightly', payDay: null, anchorDate: '2026-10-16', weekendRule: 'none' };
    expect(paydaysBetween(fortnightly, '2026-09-20', '2026-11-20')).toEqual(['2026-10-02', '2026-10-16', '2026-10-30', '2026-11-13']);
  });

  it('stops at the end date', () => {
    expect(paydaysBetween({ ...monthly(25, 'none'), endDate: '2026-11-30' }, '2026-10-01', '2027-02-01'))
      .toEqual(['2026-10-25', '2026-11-25']);
  });
});

describe('periods', () => {
  it('runs from payday to the next payday, named after the month most of it falls in', () => {
    const period = periodContaining(monthly(25), '2026-11-02');
    expect(period).toMatchObject({ start: '2026-10-23', end: '2026-11-25', label: 'November 2026', weeks: 4, calendarMonth: false });
  });

  it('starts on payday itself', () => {
    expect(periodContaining(monthly(25), '2026-11-25').start).toBe('2026-11-25');
    expect(periodContaining(monthly(25), '2026-11-24').start).toBe('2026-10-23');
  });

  it('falls back to the calendar month without income, or once income has ended', () => {
    expect(periodContaining(null, '2026-11-02')).toMatchObject({ start: '2026-11-01', end: '2026-12-01', label: 'November 2026', calendarMonth: true });
    expect(periodContaining({ ...monthly(25), endDate: '2026-06-25' }, '2026-11-02').calendarMonth).toBe(true);
  });

  it('steps forwards and back', () => {
    expect(periodAt(monthly(25), '2026-11-02', 1)).toMatchObject({ start: '2026-11-25', end: '2026-12-24', label: 'December 2026' });
    expect(periodAt(monthly(25), '2026-11-02', -1)).toMatchObject({ start: '2026-09-25', end: '2026-10-23', label: 'October 2026' });
    expect(periodAt(null, '2026-11-02', 5).label).toBe('April 2027');
  });

  it('has 4 whole weeks in any month, and 2 in a fortnight', () => {
    expect(periodContaining(null, '2027-02-10').weeks).toBe(4);
    expect(periodContaining({ frequency: 'fortnightly', payDay: null, anchorDate: '2026-10-16', weekendRule: 'none' }, '2026-10-20').weeks).toBe(2);
  });
});

describe('bucketing by the payday as due', () => {
  it('keeps the unshifted window when a weekend moves payday', () => {
    // 25 October 2026 is a Sunday, paid on Friday the 23rd: the money comes on the 23rd, but
    // November's bills run from the 25th to the 24th like every other month.
    const november = periodContaining(monthly(25), '2026-10-24');
    expect(november).toMatchObject({ start: '2026-10-23', end: '2026-11-25', label: 'November 2026' });
    expect(november.bucket).toEqual({ start: '2026-10-25', end: '2026-11-25', dayOfMonth: 25 });
    expect(paydaysDueAndPaid(monthly(25), '2026-10-01', '2026-11-01')).toEqual([{ due: '2026-10-25', paid: '2026-10-23' }]);

    expect(inBucket(november, '2026-10-24')).toBe(false);
    expect(inBucket(november, '2026-10-25')).toBe(true);
    expect(inBucket(november, '2026-11-24')).toBe(true);
    expect(inBucket(november, '2026-11-25')).toBe(false);
  });

  it('gives each period one bill on the 30th or 31st when pay is on the 31st', () => {
    const pay31 = monthly(31, 'none');
    // Pay on 31 Oct, 30 Nov (clamped), 31 Dec.
    const november = periodContaining(pay31, '2026-11-10');
    const december = periodContaining(pay31, '2026-12-10');
    expect(november.bucket).toEqual({ start: '2026-10-31', end: '2026-11-30', dayOfMonth: 31 });
    const on30 = ['2026-10-30', '2026-11-30', '2026-12-30'];
    expect(on30.filter((day) => inBucket(november, day, 30))).toEqual(['2026-11-30']);
    expect(on30.filter((day) => inBucket(december, day, 30))).toEqual(['2026-12-30']);
    // A bill on the 31st, clamped to 30 November, belongs to December's period, like 31 October to November's.
    const on31 = ['2026-10-31', '2026-11-30', '2026-12-31'];
    expect(on31.filter((day) => inBucket(november, day, 31))).toEqual(['2026-10-31']);
    expect(on31.filter((day) => inBucket(december, day, 31))).toEqual(['2026-11-30']);
  });

  it('buckets by the paid days for weekly kinds and calendar months', () => {
    const fortnightly = { frequency: 'fortnightly', payDay: null, anchorDate: '2026-10-16', weekendRule: 'none' };
    const period = periodContaining(fortnightly, '2026-10-20');
    expect(period.bucket).toEqual({ start: period.start, end: period.end, dayOfMonth: null });
    expect(periodContaining(null, '2026-11-02').bucket).toEqual({ start: '2026-11-01', end: '2026-12-01', dayOfMonth: null });
  });
});
