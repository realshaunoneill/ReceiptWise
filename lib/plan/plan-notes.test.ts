import { describe, expect, it } from 'vitest';
import { type PlanLine } from './compute-plan';
import { planNotes } from './plan-notes';

const line = (extra: Partial<PlanLine>): PlanLine => ({
  key: Math.random().toString(), source: 'recurring', sourceId: 'x', label: 'x', date: '2026-11-01', amountCents: 100,
  currency: 'EUR', direction: 'out', status: 'planned', estimated: false, counted: true, ownerUserId: 'u', householdId: null,
  ...extra,
});

describe('planNotes', () => {
  it('says what the totals include or leave out', () => {
    expect(planNotes([
      line({ estimated: true }),
      line({ estimated: true }),
      line({ estimated: true, status: 'paid' }),
      line({ status: 'overdue' }),
      line({ currency: 'USD', counted: false, notCountedReason: 'other_currency' }),
    ])).toEqual(['Includes 2 estimates', '1 overdue', '1 USD item not counted']);
  });

  it('says nothing when there is nothing to say', () => {
    expect(planNotes([line({})])).toEqual([]);
  });
});
