import { describe, expect, it } from 'vitest';
import { glanceTimeline, planGlance } from './glance';

const line = (label: string, date: string, extra: Record<string, unknown> = {}) => ({
  key: label, source: 'recurring' as const, sourceId: label, label, date, amountCents: 1000, currency: 'EUR', direction: 'out' as const,
  status: 'planned' as const, estimated: false, counted: true, ownerUserId: 'u', householdId: null, kind: 'bill', ...extra,
});

const plan = {
  currency: 'EUR',
  period: { label: 'November 2026', start: '2026-10-23', end: '2026-11-25' } as never,
  totals: { incomeCents: 0, outgoingCents: 0, remainingCents: 0, weeklyCents: 4493, paidOutCents: 0, toGoCents: 0 },
  lines: [
    { ...line('Salary', '2026-10-23'), source: 'income' as const, direction: 'in' as const, amountCents: 382000, kind: undefined },
    line('Rent', '2026-11-01'),
    line('Car loan', '2026-10-20', { status: 'overdue' }),
    line('Netflix', '2026-11-03', { kind: 'subscription', status: 'paid' }),
    line('Electric Ireland', '2026-11-14', { estimated: true }),
  ],
};

describe('plan glance', () => {
  it('keeps the unpaid bills from today on, overdue ones included, soonest first', () => {
    const glance = planGlance(plan, '2026-10-27');
    expect(glance.bills.map((bill) => bill.label)).toEqual(['Car loan', 'Rent', 'Electric Ireland']);
    expect(glance.bills[0].overdue).toBe(true);
    expect(glance.payday).toBe('2026-11-25');
    expect(glance.afterBillsCents).toBe(382000 - 3000);
  });

  it('counts down to payday, drops bills as their day passes, and says when it is stale', () => {
    const entries = glanceTimeline(planGlance(plan, '2026-10-27'), '2026-10-27');
    expect(entries).toHaveLength(14);
    expect(entries[0]).toMatchObject({ date: '2026-10-27', daysToPayday: 29, stale: false });
    expect(entries[6].bills.map((bill) => bill.label)).toEqual(['Car loan', 'Electric Ireland']);
    expect(entries[13].stale).toBe(true);
  });
});
