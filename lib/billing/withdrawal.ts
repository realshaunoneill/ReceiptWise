/*
 * Cancelling Premium, and the EU right to withdraw (Directive 2023/2673, Art. 11a of the Consumer
 * Rights Directive, in force from 19 June 2026): a contract made online must be as easy to leave
 * as it was to make, through a "withdraw from contract here" function that leads to a confirmation.
 *
 * What withdrawing does is what /refund already promised: within 14 days of a charge (the first
 * one after the trial, or any renewal) Premium stops now and that charge is refunded in full.
 * During the trial nothing has been charged, so it just stops. After the 14 days, cancelling ends
 * Premium at the end of the period already paid for.
 *
 * Pure, so the rules are tested without Stripe; lib/stripe.ts feeds it and carries it out.
 */

export const WITHDRAWAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Stripe subscription statuses that can still be cancelled. */
const CANCELLABLE = new Set(['active', 'trialing', 'past_due', 'unpaid']);

export type SubscriptionFacts = {
  id: string;
  status: string;
  /** Unix seconds, or null. */
  trialEnd: number | null;
  /** Unix seconds: when the period already paid for ends. */
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
};

export type ChargeFacts = {
  id: string;
  /** Minor units (cents). */
  amount: number;
  amountRefunded: number;
  currency: string;
  /** Unix seconds. */
  created: number;
  status: string;
};

export type RefundableCharge = {
  id: string;
  /** What's left to refund, in minor units. */
  amount: number;
  currency: string;
  chargedAt: string;
  /** The last moment to withdraw for this charge. */
  withdrawUntil: string;
};

export type CancelOptions =
  /** Nothing on the website to cancel. */
  | { kind: 'none' }
  /** In the free trial: withdrawing stops it now, and nothing is ever charged. */
  | { kind: 'trial'; subscriptionId: string; trialEndsAt: string | null }
  /** Within 14 days of a charge: withdraw (stop now, refund it) or cancel at the period's end. */
  | {
      kind: 'refundable';
      subscriptionId: string;
      charge: RefundableCharge;
      periodEndsAt: string | null;
      cancelAtPeriodEnd: boolean;
    }
  /** Past the 14 days: cancelling ends Premium when the paid period does. */
  | { kind: 'period_end'; subscriptionId: string; periodEndsAt: string | null; cancelAtPeriodEnd: boolean };

const iso = (seconds: number | null) => (seconds ? new Date(seconds * 1000).toISOString() : null);

/**
 * The newest charge still inside its 14 days that hasn't been fully refunded. A charge refunded in
 * part (by hand, say) is refundable for what's left.
 */
export function refundableCharge(charges: ChargeFacts[], now: Date): RefundableCharge | null {
  const candidates = charges
    .filter((c) => c.status === 'succeeded' && c.amount - c.amountRefunded > 0)
    .filter((c) => now.getTime() - c.created * 1000 <= WITHDRAWAL_DAYS * DAY_MS)
    .sort((a, b) => b.created - a.created);
  const charge = candidates[0];
  if (!charge) return null;
  return {
    id: charge.id,
    amount: charge.amount - charge.amountRefunded,
    currency: charge.currency,
    chargedAt: new Date(charge.created * 1000).toISOString(),
    withdrawUntil: new Date(charge.created * 1000 + WITHDRAWAL_DAYS * DAY_MS).toISOString(),
  };
}

export function decideCancelOptions(
  subscription: SubscriptionFacts | null,
  charges: ChargeFacts[],
  now: Date,
): CancelOptions {
  if (!subscription || !CANCELLABLE.has(subscription.status)) return { kind: 'none' };

  if (subscription.status === 'trialing') {
    return { kind: 'trial', subscriptionId: subscription.id, trialEndsAt: iso(subscription.trialEnd) };
  }

  const charge = refundableCharge(charges, now);
  const periodEndsAt = iso(subscription.currentPeriodEnd);
  if (charge) {
    return {
      kind: 'refundable',
      subscriptionId: subscription.id,
      charge,
      periodEndsAt,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };
  }
  return { kind: 'period_end', subscriptionId: subscription.id, periodEndsAt, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd };
}

export type CancelMode = 'withdraw' | 'period_end';

/** Whether a mode is on offer for these options, so the route refuses anything the page didn't show. */
export function isModeAllowed(options: CancelOptions, mode: CancelMode): boolean {
  switch (options.kind) {
    case 'none':
      return false;
    case 'trial':
      return mode === 'withdraw';
    case 'refundable':
      return mode === 'withdraw' || !options.cancelAtPeriodEnd;
    case 'period_end':
      return mode === 'period_end' && !options.cancelAtPeriodEnd;
  }
}

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: currency.toUpperCase() }).format(minor / 100);

const when = (value: string) =>
  new Intl.DateTimeFormat('en-IE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Dublin' }).format(new Date(value));

const day = (value: string) =>
  new Intl.DateTimeFormat('en-IE', { dateStyle: 'long', timeZone: 'Europe/Dublin' }).format(new Date(value));

export type CancelOutcome = {
  mode: CancelMode;
  /** When the request was received: the directive asks for it in the confirmation. */
  receivedAt: string;
  /** The account's email, as the confirmation is addressed. */
  email: string;
  /** Premium stops at once (withdrawal), or on this date. */
  endsAt: string | null;
  refund: { amount: number; currency: string; status: 'refunded' | 'pending' } | null;
  reference: string;
};

/**
 * The confirmation, as plain text: shown on the page, offered as a download, and emailed when
 * email is set up. The directive asks for the statement's content and the date and time it was
 * received, on a durable medium.
 */
export function confirmationText(outcome: CancelOutcome): string {
  const lines = [
    'ReceiptWise: confirmation',
    '',
    outcome.mode === 'withdraw'
      ? 'We received your withdrawal from your ReceiptWise Premium contract.'
      : 'We received your cancellation of ReceiptWise Premium.',
    '',
    `Account: ${outcome.email}`,
    `Received: ${when(outcome.receivedAt)} (Irish time)`,
    `Reference: ${outcome.reference}`,
    '',
  ];
  if (outcome.mode === 'withdraw') {
    lines.push('Premium has stopped, and you will not be charged again.');
    if (outcome.refund) {
      const amount = money(outcome.refund.amount, outcome.refund.currency);
      lines.push(
        outcome.refund.status === 'refunded'
          ? `We have refunded ${amount} to the card you paid with. It usually reaches you within 5 to 10 working days, depending on your bank.`
          : `We will refund ${amount} to the card you paid with within 5 working days.`,
      );
    } else {
      lines.push('You were in your free trial, so nothing was charged.');
    }
  } else {
    lines.push(
      outcome.endsAt
        ? `Premium stays on until ${day(outcome.endsAt)}, the end of the period you paid for, and then stops. You will not be charged again.`
        : 'Premium stops at the end of the period you paid for. You will not be charged again.',
    );
  }
  lines.push('', 'Your receipts, bills and plan stay in your account. Questions: support@receiptwise.io');
  return lines.join('\n');
}
