import { describe, expect, it } from 'vitest';
import { billingPeriod, priceLine, renewalTerms } from './terms';

const monthly = { priceString: '€1.99', subscriptionPeriod: 'P1M', introPrice: { price: 0, priceString: '€0.00', periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 1 } };

describe('paywall terms', () => {
  it('says the trial, then the price and how often', () => {
    expect(priceLine(monthly, true)).toBe('Free for 1 week, then €1.99 a month');
    expect(priceLine({ ...monthly, introPrice: { ...monthly.introPrice, periodUnit: 'DAY', periodNumberOfUnits: 7 } }, true)).toBe('Free for 1 week, then €1.99 a month');
  });

  it('leaves the trial out for someone who has had it', () => {
    expect(priceLine(monthly, false)).toBe('€1.99 a month');
    expect(priceLine({ priceString: '€19.99', subscriptionPeriod: 'P1Y', introPrice: null }, true)).toBe('€19.99 a year');
  });

  it('describes a paid introductory price', () => {
    expect(priceLine({ ...monthly, introPrice: { price: 0.99, priceString: '€0.99', periodUnit: 'MONTH', periodNumberOfUnits: 1, cycles: 3 } }, true))
      .toBe('€0.99 for 3 months, then €1.99 a month');
  });

  it('names the period and where to cancel', () => {
    expect(billingPeriod('P3M')).toBe('every 3 months');
    expect(billingPeriod(null)).toBe('');
    expect(renewalTerms('ios')).toContain("iPhone's Settings");
    expect(renewalTerms('android')).toContain('Google Play');
  });
});
