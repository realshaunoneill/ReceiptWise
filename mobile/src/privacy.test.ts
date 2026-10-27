import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async () => null, setItem: async () => undefined } }));

const { maskAmounts } = await import('./privacy');

describe('hide amounts', () => {
  it('masks amounts in any currency the app shows', () => {
    expect(maskAmounts('€179.73 left · €44.93 a week')).toBe('€••• left · €••• a week');
    expect(maskAmounts('− €1,580.30')).toBe('− €•••');
    expect(maskAmounts('US$2.00 and £3,000.00')).toBe('US$••• and £•••');
    expect(maskAmounts('CHF 12.50')).toBe('CHF •••');
    expect(maskAmounts('~€142.30')).toBe('~€•••');
  });

  it("leaves dates, counts and percentages alone", () => {
    expect(maskAmounts('23 Oct – 24 Nov')).toBe('23 Oct – 24 Nov');
    expect(maskAmounts('12 receipts · 1,169%')).toBe('12 receipts · 1,169%');
    expect(maskAmounts('2 × Milk')).toBe('2 × Milk');
  });
});
