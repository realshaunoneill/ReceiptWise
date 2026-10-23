import { createHash } from 'crypto';

/**
 * Matching an uploaded or forwarded bill to the recurring bill it belongs to.
 *
 * A bill says "Electric Ireland"; the user's recurring bill may be called "Electricity". The first
 * time, the user picks it; the document's provider key is then saved on that bill, and later bills
 * from the same provider go straight to it (auto-applied) when nothing about them is in doubt.
 */

const LEGAL_SUFFIXES = new Set(['ltd', 'limited', 'plc', 'dac', 'teo', 'uc', 'inc', 'llc', 'gmbh', 'bv', 'sa', 'the', 'co', 'company']);

/** "Electric Ireland Ltd." → "electric ireland"; "Bord Gáis Energy" → "bord gais energy". */
export function normaliseProvider(name: string | null | undefined): string | null {
  if (!name) return null;
  const words = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word && !LEGAL_SUFFIXES.has(word));
  return words.length > 0 ? words.join(' ') : null;
}

function words(value: string): Set<string> {
  return new Set(value.split(' ').filter((word) => word.length > 1));
}

export type MatchCandidate = {
  id: string;
  name: string;
  providerKey: string | null;
  amount: string;
  kind: string;
  status: string;
};

export type MatchSuggestion = { id: string; name: string; score: number; reason: 'confirmed_provider' | 'name' | 'amount' };

/**
 * Recurring bills this document could belong to, best first. A bill already confirmed for this
 * provider scores highest; then a name sharing words with the provider; then, for bills the user
 * named differently ("Electricity" vs "Electric Ireland"), one with a close usual amount.
 */
export function suggestMatches(
  document: { providerKey: string | null; amountCents: number | null },
  candidates: MatchCandidate[],
): MatchSuggestion[] {
  const suggestions: MatchSuggestion[] = [];
  const providerWords = document.providerKey ? words(document.providerKey) : new Set<string>();

  for (const candidate of candidates) {
    if (candidate.status === 'cancelled') continue;
    if (document.providerKey && candidate.providerKey === document.providerKey) {
      suggestions.push({ id: candidate.id, name: candidate.name, score: 1, reason: 'confirmed_provider' });
      continue;
    }

    const nameKey = normaliseProvider(candidate.name);
    let score = 0;
    let reason: MatchSuggestion['reason'] = 'name';
    if (nameKey && providerWords.size > 0) {
      const nameWords = words(nameKey);
      const shared = [...nameWords].filter((word) => providerWords.has(word) || [...providerWords].some((p) => p.startsWith(word) || word.startsWith(p))).length;
      if (shared > 0) score = 0.4 + 0.4 * (shared / Math.max(nameWords.size, providerWords.size));
    }

    const usual = Math.round(Number(candidate.amount) * 100);
    if (document.amountCents !== null && usual > 0) {
      const ratio = Math.abs(document.amountCents - usual) / usual;
      if (ratio <= 0.35) {
        const amountScore = 0.3 * (1 - ratio);
        if (score === 0) reason = 'amount';
        score += amountScore;
      }
    }
    if (candidate.kind === 'bill') score += 0.05;
    if (score >= 0.3) suggestions.push({ id: candidate.id, name: candidate.name, score: Math.min(score, 0.99), reason });
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, 5);
}

/** The same bill sent twice: same provider, amount and due date. A soft flag, not a constraint. */
export function documentFingerprint(providerKey: string | null, amountCents: number | null, dueDate: string | null): string | null {
  if (!providerKey || amountCents === null || !dueDate) return null;
  return createHash('sha256').update(`${providerKey}|${amountCents}|${dueDate}`).digest('hex').slice(0, 32);
}

/**
 * File it without asking only when nothing is in doubt: exactly one bill already confirmed for this
 * provider, a readable amount and due date, a bill-like document, and not a duplicate.
 */
export function shouldAutoApply(
  document: { documentType: string | null; amountCents: number | null; dueDate: string | null; duplicateOfId: string | null; confidence: string | null },
  suggestions: MatchSuggestion[],
): string | null {
  if (!document.documentType || !['utility_bill', 'credit_card_statement', 'invoice'].includes(document.documentType)) return null;
  if (document.amountCents === null || !document.dueDate || document.duplicateOfId || document.confidence === 'low') return null;
  const confirmed = suggestions.filter((suggestion) => suggestion.reason === 'confirmed_provider');
  return confirmed.length === 1 ? confirmed[0].id : null;
}

/** A recurring frequency from a billing period's length: a month, two months, a quarter, a year. */
export function frequencyFromPeriod(periodStart: string | null, periodEnd: string | null): 'monthly' | 'bimonthly' | 'quarterly' | 'yearly' {
  if (!periodStart || !periodEnd) return 'monthly';
  const days = (Date.parse(`${periodEnd}T00:00:00Z`) - Date.parse(`${periodStart}T00:00:00Z`)) / 86_400_000;
  if (days >= 300) return 'yearly';
  if (days >= 80) return 'quarterly';
  if (days >= 45) return 'bimonthly';
  return 'monthly';
}
