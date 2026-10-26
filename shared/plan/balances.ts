import { type LocalDate } from '../dates/local-date';
import { toCents } from '../money';

/**
 * The balances to record from the "Today's balances" form: only accounts whose figure was changed
 * (or that had none). Sending every account re-dated untouched ones to today, which hid the
 * warning that their balance was weeks old.
 */
export function changedBalances(
  accounts: Array<{ id: string; latestBalance: { balance: string } | null }>,
  values: Record<string, string | undefined>,
  asOfDate: LocalDate,
): Array<{ accountId: string; balance: string; asOfDate: LocalDate }> {
  return accounts.flatMap((account) => {
    const typed = values[account.id]?.trim();
    const cents = typed ? toCents(typed) : null;
    if (!typed || cents === null) return [];
    const before = account.latestBalance ? toCents(account.latestBalance.balance) : null;
    return before === cents ? [] : [{ accountId: account.id, balance: typed, asOfDate }];
  });
}
