import { describe, expect, it } from 'vitest';
import { receiptMismatches } from './receipt-match';
import { categoryOptions, frequencyName, itemNoun, paymentMethodLabel, paymentStatusLabel, statusLabel } from './labels';

const netflix = { name: 'Netflix', providerKey: null, amount: '17.99', currency: 'EUR' };

describe('receiptMismatches', () => {
  it('flags a receipt for something else at a different amount', () => {
    expect(receiptMismatches({ merchantName: 'AVOCA', totalAmount: '30.05', currency: 'EUR' }, netflix)).toEqual([
      { kind: 'amount', receiptCents: 3005, expectedCents: 1799 },
      { kind: 'merchant', merchant: 'AVOCA' },
    ]);
  });

  it('does not object to a card-statement name when the amount is right', () => {
    expect(receiptMismatches(
      { merchantName: 'APPLE.COM/BILL', totalAmount: '2.99', currency: 'EUR' },
      { name: 'iCloud+', amount: '2.99', currency: 'EUR' },
    )).toEqual([]);
  });

  it('accepts the right merchant at about the right amount', () => {
    expect(receiptMismatches({ merchantName: 'NETFLIX.COM', totalAmount: '17.99', currency: 'EUR' }, netflix)).toEqual([]);
    // A price rise of a euro or so is not "clearly" wrong.
    expect(receiptMismatches({ merchantName: 'Netflix International B.V.', totalAmount: '19.99', currency: 'eur' }, netflix)).toEqual([]);
  });

  it('matches on the provider a bill was confirmed for, not just its name', () => {
    const electricity = { name: 'Electricity', providerKey: 'electric ireland', amount: '142.30', currency: 'EUR' };
    expect(receiptMismatches({ merchantName: 'Electric Ireland', totalAmount: '150.00', currency: 'EUR' }, electricity)).toEqual([]);
  });

  it('says when the currency differs instead of comparing amounts across currencies', () => {
    expect(receiptMismatches({ merchantName: 'Netflix', totalAmount: '17.99', currency: 'USD' }, netflix))
      .toEqual([{ kind: 'currency', receiptCurrency: 'USD', expectedCurrency: 'EUR' }]);
  });

  it('stays quiet about what the receipt does not say', () => {
    expect(receiptMismatches({ merchantName: null, totalAmount: null, currency: null }, netflix)).toEqual([]);
    expect(receiptMismatches({ merchantName: 'SP 24', totalAmount: '17.99', currency: null }, netflix)).toEqual([]);
  });
});

describe('labels', () => {
  it('names stored values for people', () => {
    expect(frequencyName('bimonthly')).toBe('Every 2 months');
    expect(frequencyName('custom', 14)).toBe('Every 14 days');
    expect(statusLabel('active')).toBe('Active');
    expect(paymentStatusLabel('pending')).toBe('Due');
    expect(paymentMethodLabel('card')).toBe('Card');
    expect(paymentMethodLabel(null)).toBe('Not said');
    expect(itemNoun('bill', true)).toBe('bill');
    expect(itemNoun('bill', false)).toBe('subscription');
  });

  it('keeps a category that is not in the list rather than blanking it', () => {
    expect(categoryOptions('Housing').map((group) => group.label)).toEqual(['Bills', 'Subscriptions', 'Anything else']);
    expect(categoryOptions('Cloud Services')[0]).toEqual({ label: 'Current', categories: ['Cloud Services'] });
    expect(categoryOptions(null)).toHaveLength(3);
  });
});
