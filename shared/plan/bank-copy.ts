import { formatCents } from '../currency';
import { formatLocalDate } from '../dates/local-date';
import { type BalanceView, type PlanLine } from './compute-plan';

/**
 * The bank check in words, the same on the website and in the app. Its figure starts from what's
 * actually in the account today, so next to the plan's "left" (your pay less everything planned)
 * the two looked like they contradicted each other: €2,539 left, and €289 short. Saying where the
 * bank figure comes from makes both make sense.
 */

/** "Left in your account until payday", or "Your account is short before payday". */
export function bankCheckTitle(view: Pick<BalanceView, 'availableCents'>): string {
  return view.availableCents < 0 ? 'Your account is short before payday' : 'Left in your account until payday';
}

/**
 * "Current account has €2,000.00 (27 Oct) and €2,289.53 is still to go out, savings included."
 * With income still to arrive: "…, €3,820.00 is still to come in and €2,289.53 is still to go out."
 */
export function bankCheckExplainer(
  view: Pick<BalanceView, 'accounts' | 'incomingCents' | 'outgoingCents'>,
  lines: ReadonlyArray<Pick<PlanLine, 'source' | 'counted' | 'status' | 'amountCents'>>,
  currency: string,
): string {
  const money = (cents: number) => formatCents(cents, currency);
  const held = view.accounts.length === 1
    ? `${view.accounts[0].name} has ${money(view.accounts[0].balanceCents)} (${formatLocalDate(view.accounts[0].asOfDate, { day: 'numeric', month: 'short' }, 'en-IE')})`
    : `Your accounts have ${money(view.accounts.reduce((total, account) => total + account.balanceCents, 0))}`;
  const savingsToGo = lines.some((line) => line.source === 'goal' && line.counted && line.status !== 'done' && line.amountCents > 0);
  const out = `${money(view.outgoingCents)} is still to go out${savingsToGo ? ', savings included' : ''}`;
  return view.incomingCents > 0
    ? `${held}, ${money(view.incomingCents)} is still to come in and ${out}.`
    : `${held} and ${out}.`;
}
