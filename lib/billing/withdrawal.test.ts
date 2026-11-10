import { describe, expect, it } from 'vitest';
import {
  confirmationText,
  decideCancelOptions,
  isModeAllowed,
  refundableCharge,
  type ChargeFacts,
  type SubscriptionFacts,
} from './withdrawal';

const now = new Date('2026-11-10T12:00:00Z');
const secs = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

const sub = (over: Partial<SubscriptionFacts> = {}): SubscriptionFacts => ({
  id: 'sub_1',
  status: 'active',
  trialEnd: null,
  currentPeriodEnd: secs('2026-12-01T00:00:00Z'),
  cancelAtPeriodEnd: false,
  ...over,
});

const charge = (over: Partial<ChargeFacts> = {}): ChargeFacts => ({
  id: 'ch_1',
  amount: 499,
  amountRefunded: 0,
  currency: 'eur',
  created: secs('2026-11-01T09:00:00Z'),
  status: 'succeeded',
  ...over,
});

describe('refundableCharge', () => {
  it('offers the newest charge still inside its 14 days', () => {
    const charges = [charge({ id: 'old', created: secs('2026-10-01T09:00:00Z') }), charge({ id: 'new' })];
    expect(refundableCharge(charges, now)).toMatchObject({ id: 'new', amount: 499, withdrawUntil: '2026-11-15T09:00:00.000Z' });
  });

  it('stops offering it after 14 days', () => {
    expect(refundableCharge([charge({ created: secs('2026-10-27T11:59:00Z') })], now)).toBeNull();
    expect(refundableCharge([charge({ created: secs('2026-10-27T12:00:00Z') })], now)).not.toBeNull();
  });

  it('skips failed and fully refunded charges, and offers what is left of a part refund', () => {
    expect(refundableCharge([charge({ status: 'failed' })], now)).toBeNull();
    expect(refundableCharge([charge({ amountRefunded: 499 })], now)).toBeNull();
    expect(refundableCharge([charge({ amountRefunded: 200 })], now)?.amount).toBe(299);
  });
});

describe('decideCancelOptions', () => {
  it('has nothing to cancel without a live subscription', () => {
    expect(decideCancelOptions(null, [], now)).toEqual({ kind: 'none' });
    expect(decideCancelOptions(sub({ status: 'canceled' }), [charge()], now)).toEqual({ kind: 'none' });
    expect(decideCancelOptions(sub({ status: 'incomplete_expired' }), [], now)).toEqual({ kind: 'none' });
  });

  it('stops a trial now, with nothing to refund', () => {
    const options = decideCancelOptions(sub({ status: 'trialing', trialEnd: secs('2026-11-20T00:00:00Z') }), [], now);
    expect(options).toEqual({ kind: 'trial', subscriptionId: 'sub_1', trialEndsAt: '2026-11-20T00:00:00.000Z' });
    expect(isModeAllowed(options, 'withdraw')).toBe(true);
    expect(isModeAllowed(options, 'period_end')).toBe(false);
  });

  it('offers a refund within 14 days of a renewal, and past-due subscriptions can still go', () => {
    const options = decideCancelOptions(sub({ status: 'past_due' }), [charge()], now);
    expect(options.kind).toBe('refundable');
    expect(isModeAllowed(options, 'withdraw')).toBe(true);
    expect(isModeAllowed(options, 'period_end')).toBe(true);
  });

  it('only cancels at the period end after the 14 days, and only once', () => {
    const options = decideCancelOptions(sub(), [charge({ created: secs('2026-10-01T00:00:00Z') })], now);
    expect(options).toMatchObject({ kind: 'period_end', periodEndsAt: '2026-12-01T00:00:00.000Z' });
    expect(isModeAllowed(options, 'withdraw')).toBe(false);
    expect(isModeAllowed(options, 'period_end')).toBe(true);
    const already = decideCancelOptions(sub({ cancelAtPeriodEnd: true }), [], now);
    expect(isModeAllowed(already, 'period_end')).toBe(false);
  });

  it('still lets someone who already cancelled withdraw while the charge is refundable', () => {
    const options = decideCancelOptions(sub({ cancelAtPeriodEnd: true }), [charge()], now);
    expect(isModeAllowed(options, 'withdraw')).toBe(true);
    expect(isModeAllowed(options, 'period_end')).toBe(false);
  });
});

describe('confirmationText', () => {
  const base = { receivedAt: '2026-11-10T12:00:00.000Z', email: 'aoife@example.com', reference: 'sub_1' };

  it('says what was received, when, and what happens to the money', () => {
    const text = confirmationText({ ...base, mode: 'withdraw', endsAt: null, refund: { amount: 499, currency: 'eur', status: 'refunded' } });
    expect(text).toContain('withdrawal from your ReceiptWise Premium contract');
    expect(text).toContain('10 November 2026');
    expect(text).toContain('aoife@example.com');
    expect(text).toContain('€4.99');
  });

  it('gives the end date when cancelling at the period end', () => {
    const text = confirmationText({ ...base, mode: 'period_end', endsAt: '2026-12-01T00:00:00.000Z', refund: null });
    expect(text).toContain('cancellation of ReceiptWise Premium');
    expect(text).toContain('1 December 2026');
  });

  it('says nothing was charged for a trial', () => {
    expect(confirmationText({ ...base, mode: 'withdraw', endsAt: null, refund: null })).toContain('nothing was charged');
  });
});
