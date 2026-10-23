import { describe, expect, it } from 'vitest';
import { BillingSchedule, monthlyEquivalent, type ScheduleFields } from './billing-schedule';

const d = (day: string) => new Date(`${day}T00:00:00.000Z`);
const days = (dates: Date[]) => dates.map((date) => date.toISOString().slice(0, 10));

function schedule(fields: Partial<ScheduleFields> & Pick<ScheduleFields, 'billingFrequency'>): BillingSchedule {
  return new BillingSchedule({
    startDate: d('2026-01-01'),
    billingDay: 1,
    customFrequencyDays: null,
    endDate: null,
    ...fields,
  });
}

describe('BillingSchedule', () => {
  it('clamps the 31st to short months without drifting', () => {
    const s = schedule({ billingFrequency: 'monthly', startDate: d('2026-01-31'), billingDay: 31 });
    expect(days(s.cyclesThrough(d('2026-05-01')))).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('uses Feb 29 in a leap year', () => {
    const s = schedule({ billingFrequency: 'monthly', startDate: d('2028-01-30'), billingDay: 30 });
    expect(days(s.cyclesThrough(d('2028-03-31')))).toEqual(['2028-01-30', '2028-02-29', '2028-03-30']);
  });

  it('starts at the first billing day on or after the start date', () => {
    const s = schedule({ billingFrequency: 'monthly', startDate: d('2026-03-20'), billingDay: 5 });
    expect(days(s.cyclesThrough(d('2026-06-01')))).toEqual(['2026-04-05', '2026-05-05']);
  });

  it('steps every two months, clamping the day', () => {
    expect(days(schedule({ billingFrequency: 'bimonthly', startDate: d('2026-08-31'), billingDay: 31 }).cyclesThrough(d('2027-03-01'))))
      .toEqual(['2026-08-31', '2026-10-31', '2026-12-31', '2027-02-28']);
  });

  it('steps six-monthly, quarterly and yearly from the anchor', () => {
    expect(days(schedule({ billingFrequency: 'six_monthly', billingDay: 15 }).cyclesThrough(d('2027-08-01'))))
      .toEqual(['2026-01-15', '2026-07-15', '2027-01-15', '2027-07-15']);
    expect(days(schedule({ billingFrequency: 'quarterly', billingDay: 10 }).cyclesThrough(d('2026-08-01'))))
      .toEqual(['2026-01-10', '2026-04-10', '2026-07-10']);
    expect(days(schedule({ billingFrequency: 'yearly', billingDay: 1 }).cyclesThrough(d('2028-06-01'))))
      .toEqual(['2026-01-01', '2027-01-01', '2028-01-01']);
  });

  it('repeats custom frequencies every N days from the start', () => {
    const s = schedule({ billingFrequency: 'custom', customFrequencyDays: 14, startDate: d('2026-01-05') });
    expect(days(s.cyclesThrough(d('2026-02-10')))).toEqual(['2026-01-05', '2026-01-19', '2026-02-02']);
  });

  it('has a single cycle on the start date for a one-off', () => {
    const s = schedule({ billingFrequency: 'once', startDate: d('2026-11-14'), billingDay: 1 });
    expect(days(s.cyclesThrough(d('2030-01-01')))).toEqual(['2026-11-14']);
    expect(days(s.cyclesThrough(d('2026-11-13')))).toEqual([]);
    expect(days(s.cyclesBetween(d('2026-11-01'), d('2026-12-01')))).toEqual(['2026-11-14']);
    expect(s.firstCycleOnOrAfter(d('2026-11-15'))).toBeNull();
    expect(s.firstCycleOnOrAfter(d('2026-11-14'))?.toISOString().slice(0, 10)).toBe('2026-11-14');
  });

  it('stops at the end date', () => {
    const s = schedule({ billingFrequency: 'monthly', billingDay: 1, endDate: d('2026-03-15') });
    expect(days(s.cyclesThrough(d('2026-12-01')))).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(s.firstCycleOnOrAfter(d('2026-03-16'))).toBeNull();
    expect(days(s.cyclesBetween(d('2026-01-15'), d('2026-12-01')))).toEqual(['2026-02-01', '2026-03-01']);
  });

  describe('cyclesBetween', () => {
    const s = schedule({ billingFrequency: 'monthly', billingDay: 25 });

    it('excludes both ends', () => {
      expect(days(s.cyclesBetween(d('2026-01-25'), d('2026-03-25')))).toEqual(['2026-02-25']);
    });

    it('includes cycles strictly inside the window', () => {
      expect(days(s.cyclesBetween(d('2026-01-24'), d('2026-03-26')))).toEqual(['2026-01-25', '2026-02-25', '2026-03-25']);
    });

    it('returns nothing before the first cycle or for an empty window', () => {
      expect(days(s.cyclesBetween(d('2025-06-01'), d('2026-01-01')))).toEqual([]);
      expect(days(s.cyclesBetween(d('2026-02-01'), d('2026-02-01')))).toEqual([]);
    });

    it('works for custom frequencies far from the start', () => {
      const daily = schedule({ billingFrequency: 'custom', customFrequencyDays: 7, startDate: d('2020-01-06') });
      expect(days(daily.cyclesBetween(d('2026-10-20'), d('2026-11-05')))).toEqual(['2026-10-26', '2026-11-02']);
    });
  });

  it('matches existing rows within 3 days, or under half a custom cycle', () => {
    expect(schedule({ billingFrequency: 'monthly' }).matchToleranceMs).toBe(3 * 86_400_000);
    expect(schedule({ billingFrequency: 'custom', customFrequencyDays: 7 }).matchToleranceMs).toBe(3 * 86_400_000);
    expect(schedule({ billingFrequency: 'custom', customFrequencyDays: 2 }).matchToleranceMs).toBe(0);
  });
});

describe('monthlyEquivalent', () => {
  it('normalises each frequency to a month', () => {
    expect(monthlyEquivalent(12, 'monthly')).toBe(12);
    expect(monthlyEquivalent(20, 'bimonthly')).toBe(10);
    expect(monthlyEquivalent(30, 'quarterly')).toBe(10);
    expect(monthlyEquivalent(60, 'six_monthly')).toBe(10);
    expect(monthlyEquivalent(120, 'yearly')).toBe(10);
    expect(monthlyEquivalent(100, 'once')).toBe(0);
    expect(monthlyEquivalent(10, 'custom', 7)).toBeCloseTo(43.48, 2);
  });

  it('treats an unknown frequency as monthly and a non-number as zero', () => {
    expect(monthlyEquivalent(5, 'fortnightly')).toBe(5);
    expect(monthlyEquivalent(Number.NaN, 'monthly')).toBe(0);
  });
});
