import { describe, expect, it } from 'vitest';
import { fromCents, sumCents, toCents } from './money';

describe('toCents', () => {
  it('parses decimal strings exactly', () => {
    expect(toCents('12.34')).toBe(1234);
    expect(toCents('0.1')).toBe(10);
    expect(toCents('7')).toBe(700);
    expect(toCents(' 19.99 ')).toBe(1999);
    expect(toCents('-42.50')).toBe(-4250);
  });

  it('rounds half away from zero at the third decimal', () => {
    expect(toCents('1.005')).toBe(101);
    expect(toCents('1.004')).toBe(100);
    expect(toCents('-1.005')).toBe(-101);
  });

  it('accepts numbers', () => {
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(0)).toBe(0);
  });

  it('rejects anything that is not a plain decimal', () => {
    for (const value of ['', 'abc', '1e3', '1,50', '€5', '--1', '1.2.3', null, undefined, Number.NaN, Infinity]) {
      expect(toCents(value as string | number | null | undefined)).toBeNull();
    }
  });

  it('never returns negative zero', () => {
    expect(Object.is(toCents('-0.00'), 0)).toBe(true);
  });
});

describe('fromCents', () => {
  it('formats two decimals', () => {
    expect(fromCents(1234)).toBe('12.34');
    expect(fromCents(5)).toBe('0.05');
    expect(fromCents(-5)).toBe('-0.05');
    expect(fromCents(0)).toBe('0.00');
    expect(fromCents(100000)).toBe('1000.00');
  });

  it('round-trips with toCents', () => {
    for (const value of ['0.01', '9.99', '1234.56', '-0.30']) {
      expect(fromCents(toCents(value)!)).toBe(value);
    }
  });
});

describe('sumCents', () => {
  it('adds the amounts that parsed and skips the rest', () => {
    expect(sumCents([toCents('0.1'), toCents('0.2'), toCents('bad'), undefined])).toBe(30);
    expect(sumCents([])).toBe(0);
  });
});
