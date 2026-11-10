import { describe, expect, it } from 'vitest';
import { premiumBilling, premiumPeriod, stripeBillingDetail } from './premium';

const base = { active: true, productId: null, expiresAt: null, willRenew: null, inTrial: false };

describe('premiumBilling', () => {
  it('says how each source bills, and when it renews, ends or the trial runs out', () => {
    expect(premiumBilling({ ...base, source: 'stripe' })).toEqual({ title: 'Billed through the ReceiptWise website', detail: null, manage: null });
    expect(premiumBilling({ ...base, source: 'app_store', productId: 'io.receiptwise.premium.monthly', expiresAt: '2026-11-27T10:00:00Z', willRenew: true }))
      .toMatchObject({ title: 'Billed through the App Store', detail: 'Monthly · renews 27 Nov 2026' });
    expect(premiumBilling({ ...base, source: 'play_store', productId: 'premium:yearly', expiresAt: '2027-10-27T10:00:00Z', willRenew: false })?.detail).toBe('Yearly · ends 27 Oct 2027');
    expect(premiumBilling({ ...base, source: 'app_store', expiresAt: '2026-11-03T10:00:00Z', inTrial: true })?.detail).toBe('Free trial until 3 Nov 2026');
    expect(premiumBilling({ ...base, source: 'comp', expiresAt: '2027-10-27T10:00:00Z' })).toEqual({ title: 'Free Premium, given to you', detail: 'Until 27 Oct 2027', manage: null });
  });

  it('names whose Premium covers someone in a household', () => {
    expect(premiumBilling({ ...base, source: 'household', coveredBy: 'Aoife' })?.title).toBe("Covered by Aoife's Premium");
    expect(premiumBilling({ ...base, source: 'household', coveredBy: null })?.title).toBe('Covered by your household');
    expect(premiumBilling({ ...base, source: 'household' })?.manage).toBeNull();
  });

  it('is nothing without Premium of its own', () => {
    expect(premiumBilling({ ...base, active: false, source: null })).toBeNull();
    expect(premiumBilling(undefined)).toBeNull();
  });

  it('names the period from the product id', () => {
    expect(premiumPeriod('io.receiptwise.premium.yearly')).toBe('Yearly');
    expect(premiumPeriod('premium:monthly')).toBe('Monthly');
    expect(premiumPeriod('something')).toBeNull();
  });
});

describe('stripeBillingDetail', () => {
  const s = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

  it('says when a trial ends, a subscription renews, or a cancelled one stops', () => {
    expect(stripeBillingDetail({ status: 'trialing', trialEnd: s('2026-11-24T10:00:00Z') }).detail).toBe('Free trial until 24 Nov 2026');
    expect(stripeBillingDetail({ status: 'active', currentPeriodEnd: s('2026-12-01T10:00:00Z') }).detail).toBe('Renews 1 Dec 2026');
    expect(stripeBillingDetail({ status: 'active', currentPeriodEnd: s('2026-12-01T10:00:00Z'), cancelAtPeriodEnd: true }).detail).toBe('Ends 1 Dec 2026');
  });

  it('warns when a payment failed', () => {
    expect(stripeBillingDetail({ status: 'past_due', currentPeriodEnd: s('2026-12-01T10:00:00Z') }).warning).toMatch(/Update your card/);
    expect(stripeBillingDetail({ status: 'active' }).warning).toBeNull();
    expect(stripeBillingDetail(null)).toEqual({ detail: null, warning: null });
  });
});
