import { describe, expect, it } from 'vitest';
import { categoryName, formatDisplayDate, formatPaymentMethod, receiptDay, receiptFileName } from './format';

describe('formatDisplayDate', () => {
  it('formats a calendar day in en-IE without shifting it', () => {
    expect(formatDisplayDate('2026-10-21')).toBe('21 Oct 2026');
    expect(formatDisplayDate('2026-01-01')).toBe('1 Jan 2026');
  });

  it('is empty for nothing, and passes through a string it cannot read', () => {
    expect(formatDisplayDate(null)).toBe('');
    expect(formatDisplayDate('')).toBe('');
    expect(formatDisplayDate('sometime')).toBe('sometime');
  });
});

describe('receiptDay', () => {
  it('prefers the transaction date', () => {
    expect(receiptDay({ transactionDate: '2026-10-21', createdAt: '2026-10-23T10:00:00Z' })).toBe('2026-10-21');
  });

  it('falls back to the upload day, and to null', () => {
    expect(receiptDay({ transactionDate: null, createdAt: new Date(2026, 9, 23, 12) })).toBe('2026-10-23');
    expect(receiptDay({ transactionDate: null, createdAt: null })).toBeNull();
  });
});

describe('formatPaymentMethod', () => {
  it('keeps brand casing', () => {
    expect(formatPaymentMethod('Apple Pay')).toBe('Apple Pay');
    expect(formatPaymentMethod('apple_pay')).toBe('Apple Pay');
    expect(formatPaymentMethod('chip & pin')).toBe('Chip & PIN');
    expect(formatPaymentMethod('GOOGLE PAY')).toBe('Google Pay');
  });

  it('sentence-cases plain values and leaves mixed case alone', () => {
    expect(formatPaymentMethod('contactless')).toBe('Contactless');
    expect(formatPaymentMethod('direct_debit')).toBe('Direct debit');
    expect(formatPaymentMethod('Visa Debit')).toBe('Visa Debit');
  });
});

describe('categoryName', () => {
  it('uses the shared label for scanner categories', () => {
    expect(categoryName('gas')).toBe('Fuel');
    expect(categoryName('Gas')).toBe('Fuel');
    expect(categoryName(null)).toBe('Other');
  });

  it('keeps a free-text item category instead of calling it Other', () => {
    expect(categoryName('dairy')).toBe('Dairy');
    expect(categoryName('soft_drinks')).toBe('Soft drinks');
  });
});

describe('receiptFileName', () => {
  it('is the merchant and the day', () => {
    expect(receiptFileName('Tesco', '2026-10-21', 'image/jpeg')).toBe('tesco-2026-10-21.jpg');
    expect(receiptFileName('Café Nero, Dún Laoghaire', '2026-10-21', 'image/png')).toBe('cafe-nero-dun-laoghaire-2026-10-21.png');
  });

  it('falls back to "receipt" and to jpg', () => {
    expect(receiptFileName(null, null)).toBe('receipt.jpg');
    expect(receiptFileName('!!!', '2026-10-21', 'application/octet-stream')).toBe('receipt-2026-10-21.jpg');
  });
});
