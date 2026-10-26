import { describe, expect, it } from 'vitest';
import { changedBalances } from './balances';

describe('changedBalances', () => {
  const accounts = [
    { id: 'current', latestBalance: { balance: '1200.50' } },
    { id: 'savings', latestBalance: { balance: '9000.00' } },
    { id: 'cash', latestBalance: null },
  ];

  it('only sends accounts whose balance changed, or had none', () => {
    expect(changedBalances(accounts, { current: '1200.5', savings: '9100', cash: '40' }, '2026-10-24')).toEqual([
      { accountId: 'savings', balance: '9100', asOfDate: '2026-10-24' },
      { accountId: 'cash', balance: '40', asOfDate: '2026-10-24' },
    ]);
  });

  it('ignores blanks and things that are not numbers', () => {
    expect(changedBalances(accounts, { current: '', savings: 'lots' }, '2026-10-24')).toEqual([]);
  });
});
