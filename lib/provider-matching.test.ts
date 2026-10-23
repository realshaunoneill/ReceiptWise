import { describe, expect, it } from 'vitest';
import { documentFingerprint, frequencyFromPeriod, normaliseProvider, shouldAutoApply, suggestMatches } from './provider-matching';

const bill = (id: string, name: string, amount: string, providerKey: string | null = null) =>
  ({ id, name, amount, providerKey, kind: 'bill', status: 'active' });

describe('normaliseProvider', () => {
  it('drops legal suffixes, punctuation and accents', () => {
    expect(normaliseProvider('Electric Ireland Ltd.')).toBe('electric ireland');
    expect(normaliseProvider('Bord Gáis Energy')).toBe('bord gais energy');
    expect(normaliseProvider('Vodafone Ireland DAC')).toBe('vodafone ireland');
    expect(normaliseProvider('AIB & Co')).toBe('aib and');
    expect(normaliseProvider('  ')).toBeNull();
  });
});

describe('suggestMatches', () => {
  const candidates = [
    bill('elec', 'Electricity', '120'),
    bill('broadband', 'Eir broadband', '60'),
    bill('car', 'Car', '469'),
  ];

  it('prefers a bill already confirmed for this provider', () => {
    const withKey = [...candidates, bill('ei', 'Electric (old)', '90', 'electric ireland')];
    expect(suggestMatches({ providerKey: 'electric ireland', amountCents: 13000 }, withKey)[0]).toMatchObject({ id: 'ei', reason: 'confirmed_provider', score: 1 });
  });

  it('matches on shared words, and on a close usual amount when the name differs', () => {
    expect(suggestMatches({ providerKey: 'eir', amountCents: 6000 }, candidates)[0].id).toBe('broadband');
    const byAmount = suggestMatches({ providerKey: 'electric ireland', amountCents: 11500 }, candidates);
    expect(byAmount[0].id).toBe('elec');
  });

  it('suggests nothing for an unrelated bill', () => {
    expect(suggestMatches({ providerKey: 'irish water', amountCents: 999900 }, candidates)).toEqual([]);
  });
});

describe('shouldAutoApply', () => {
  const doc = { documentType: 'utility_bill', amountCents: 12000, dueDate: '2026-11-14', duplicateOfId: null, confidence: 'high' };
  const confirmed = [{ id: 'elec', name: 'Electricity', score: 1, reason: 'confirmed_provider' as const }];

  it('files a bill from a confirmed provider', () => {
    expect(shouldAutoApply(doc, confirmed)).toBe('elec');
  });

  it('asks when anything is in doubt', () => {
    expect(shouldAutoApply({ ...doc, dueDate: null }, confirmed)).toBeNull();
    expect(shouldAutoApply({ ...doc, duplicateOfId: 'x' }, confirmed)).toBeNull();
    expect(shouldAutoApply({ ...doc, confidence: 'low' }, confirmed)).toBeNull();
    expect(shouldAutoApply({ ...doc, documentType: 'receipt' }, confirmed)).toBeNull();
    expect(shouldAutoApply(doc, [{ ...confirmed[0], reason: 'name' }])).toBeNull();
    expect(shouldAutoApply(doc, [...confirmed, { ...confirmed[0], id: 'other' }])).toBeNull();
  });
});

describe('documentFingerprint and frequencyFromPeriod', () => {
  it('fingerprints provider, amount and due date', () => {
    expect(documentFingerprint('eir', 6000, '2026-11-01')).toBe(documentFingerprint('eir', 6000, '2026-11-01'));
    expect(documentFingerprint('eir', 6000, '2026-11-01')).not.toBe(documentFingerprint('eir', 6001, '2026-11-01'));
    expect(documentFingerprint(null, 6000, '2026-11-01')).toBeNull();
  });

  it('guesses the frequency from the billing period', () => {
    expect(frequencyFromPeriod('2026-09-01', '2026-09-30')).toBe('monthly');
    expect(frequencyFromPeriod('2026-08-20', '2026-10-19')).toBe('bimonthly');
    expect(frequencyFromPeriod('2026-07-01', '2026-09-30')).toBe('quarterly');
    expect(frequencyFromPeriod(null, null)).toBe('monthly');
  });
});
