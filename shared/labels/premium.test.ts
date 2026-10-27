import { describe, expect, it } from 'vitest';
import { premiumBilling, premiumPeriod } from './premium';

const base = { active: true, productId: null, expiresAt: null, willRenew: null, inTrial: false };

describe('premiumBilling', () => {
  it('says how each source bills, and when it renews, ends or the trial runs out', () => {
    expect(premiumBilling({ ...base, source: 'stripe' })).toEqual({ title: 'Billed through the ReceiptWise website', detail: null, manage: null });
    expect(premiumBilling({ ...base, source: 'app_store', productId: 'io.receiptwise.premium.monthly', expiresAt: '2026-11-27T10:00:00Z', willRenew: true }))
      .toMatchObject({ title: 'Billed through the App Store', detail: 'Monthly · renews 27 Nov 2026' });
    expect(premiumBilling({ ...base, source: 'play_store', productId: 'premium:yearly', expiresAt: '2027-10-27T10:00:00Z', willRenew: false })?.detail).toBe('Yearly · ends 27 Oct 2027');
    expect(premiumBilling({ ...base, source: 'app_store', expiresAt: '2026-11-03T10:00:00Z', inTrial: true })?.detail).toBe('Free trial until 3 Nov 2026');
    expect(premiumBilling({ ...base, source: 'comp', expiresAt: '2027-10-27T10:00:00Z' })).toEqual({ title: 'Given to this account', detail: 'Until 27 Oct 2027', manage: null });
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
