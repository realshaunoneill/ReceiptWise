import { describe, expect, it } from 'vitest';
import { periodContaining } from '../schedule/pay-schedule';
import { firstBillDate } from './new-bill';

const pay25 = { frequency: 'monthly', payDay: 25, anchorDate: null, weekendRule: 'previous_business_day' };

describe('firstBillDate', () => {
  it('starts a new monthly bill in the period being planned, even if its day has passed', () => {
    // November 2026: paid Friday 23 October, bills from the 25th to the 24th.
    const november = periodContaining(pay25, '2026-11-10');
    expect(firstBillDate(november, 1)).toBe('2026-11-01');
    expect(firstBillDate(november, 24)).toBe('2026-11-24');
    expect(firstBillDate(november, 25)).toBe('2026-10-25');
  });

  it('clamps the 31st to a short month', () => {
    const calendarFebruary = periodContaining(null, '2027-02-10');
    expect(firstBillDate(calendarFebruary, 31)).toBe('2027-02-28');
  });

  it('falls after a short period when the day is not in it', () => {
    const weekly = periodContaining({ frequency: 'weekly', payDay: null, anchorDate: '2026-10-23', weekendRule: 'none' }, '2026-10-24');
    expect(weekly).toMatchObject({ start: '2026-10-23', end: '2026-10-30' });
    expect(firstBillDate(weekly, 25)).toBe('2026-10-25');
    expect(firstBillDate(weekly, 5)).toBe('2026-11-05');
  });
});
