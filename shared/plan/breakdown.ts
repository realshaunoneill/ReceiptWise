import { type PlanLine } from './compute-plan';

/**
 * The plan read the way people ask it: what comes in, what the bills take, what's left after the
 * bills, then the rest (subscriptions, savings, this month's one-offs) and what's left at the end.
 * "After bills" is the figure for "can I cover the essentials, and what have I got after them":
 * bills are the recurring items marked as bills (rent, loans, the electricity, a credit card),
 * subscriptions the rest. Only counted lines go in, so it adds up to the plan's own totals.
 */
export type PlanBreakdown = {
  incomeCents: number;
  billsCents: number;
  afterBillsCents: number;
  subscriptionsCents: number;
  savingsCents: number;
  oneOffsCents: number;
  leftCents: number;
  /** A bill or subscription on its usual amount until its bill comes in: the total is a guess. */
  estimated: boolean;
};

export function planBreakdown(lines: ReadonlyArray<Pick<PlanLine, 'source' | 'direction' | 'kind' | 'amountCents' | 'counted' | 'estimated' | 'status'>>): PlanBreakdown {
  const counted = lines.filter((line) => line.counted);
  const sum = (match: (line: (typeof counted)[number]) => boolean) => counted.filter(match).reduce((total, line) => total + line.amountCents, 0);
  const out = (line: (typeof counted)[number]) => line.direction === 'out';
  const incomeCents = sum((line) => line.direction === 'in');
  const billsCents = sum((line) => out(line) && line.source === 'recurring' && line.kind === 'bill');
  const subscriptionsCents = sum((line) => out(line) && line.source === 'recurring' && line.kind !== 'bill');
  const savingsCents = sum((line) => out(line) && line.source === 'goal');
  const oneOffsCents = sum((line) => out(line) && line.source === 'entry');
  const afterBillsCents = incomeCents - billsCents;
  return {
    incomeCents,
    billsCents,
    afterBillsCents,
    subscriptionsCents,
    savingsCents,
    oneOffsCents,
    leftCents: afterBillsCents - subscriptionsCents - savingsCents - oneOffsCents,
    estimated: counted.some((line) => out(line) && line.source === 'recurring' && line.estimated && line.status !== 'paid'),
  };
}
