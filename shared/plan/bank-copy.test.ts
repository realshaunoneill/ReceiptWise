import { describe, expect, it } from 'vitest';
import { bankCheckExplainer, bankCheckTitle } from './bank-copy';

const current = { id: 'a', name: 'Current account', balanceCents: 200000, asOfDate: '2026-10-27', stale: false };
const savingsLine = { source: 'goal' as const, counted: true, status: 'planned' as const, amountCents: 150000 };

describe('bank check copy', () => {
  it('says where the figure comes from: the balance, and what is still to go out', () => {
    expect(bankCheckExplainer({ accounts: [current], incomingCents: 0, outgoingCents: 228953 }, [savingsLine], 'EUR'))
      .toBe('Current account has €2,000.00 (27 Oct) and €2,289.53 is still to go out, savings included.');
  });

  it('adds income still to come, and leaves out savings once they are put aside', () => {
    expect(bankCheckExplainer(
      { accounts: [current, { ...current, id: 'b', name: 'Joint', balanceCents: 5000 }], incomingCents: 382000, outgoingCents: 100000 },
      [{ ...savingsLine, status: 'done' }],
      'EUR',
    )).toBe('Your accounts have €2,050.00, €3,820.00 is still to come in and €1,000.00 is still to go out.');
  });

  it('titles a shortfall differently', () => {
    expect(bankCheckTitle({ availableCents: -28953 })).toBe('Your account is short before payday');
    expect(bankCheckTitle({ availableCents: 100 })).toBe('Left in your account until payday');
  });
});
