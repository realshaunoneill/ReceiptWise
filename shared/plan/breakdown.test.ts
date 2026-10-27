import { describe, expect, it } from 'vitest';
import { planBreakdown } from './breakdown';

const line = (source: 'income' | 'recurring' | 'entry' | 'goal', amountCents: number, extra: Partial<Parameters<typeof planBreakdown>[0][number]> = {}) => ({
  source, amountCents, direction: source === 'income' ? 'in' as const : 'out' as const, counted: true, estimated: false, status: 'planned' as const, ...extra,
});

describe('plan breakdown', () => {
  it('takes the bills off the pay first, then the rest', () => {
    const breakdown = planBreakdown([
      line('income', 382000),
      line('recurring', 30000, { kind: 'bill' }),
      line('recurring', 54712, { kind: 'bill', estimated: true }),
      line('recurring', 1399, { kind: 'subscription' }),
      line('goal', 50000),
      line('entry', 8500),
      line('entry', 2000, { direction: 'in' }),
    ]);
    expect(breakdown).toMatchObject({ incomeCents: 384000, billsCents: 84712, afterBillsCents: 299288, subscriptionsCents: 1399, savingsCents: 50000, oneOffsCents: 8500, estimated: true });
    expect(breakdown.leftCents).toBe(384000 - 84712 - 1399 - 50000 - 8500);
  });

  it("leaves out what the plan doesn't count (skipped, another currency)", () => {
    const breakdown = planBreakdown([line('income', 100000), line('recurring', 5000, { kind: 'bill', counted: false })]);
    expect(breakdown.billsCents).toBe(0);
    expect(breakdown.leftCents).toBe(100000);
  });

  it('is no longer an estimate once the bill is paid', () => {
    expect(planBreakdown([line('recurring', 5000, { kind: 'bill', estimated: true, status: 'paid' })]).estimated).toBe(false);
  });
});
