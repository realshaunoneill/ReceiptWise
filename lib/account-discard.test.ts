import { describe, expect, it } from 'vitest';
import { discardRefusal, type DiscardFacts } from './account-discard';

const now = new Date('2026-10-26T12:00:00Z');
const fresh: DiscardFacts = { createdAt: new Date('2026-10-26T11:55:00Z'), stripeCustomerId: null, signInMethods: 1, ownedRows: 0 };

describe('discardRefusal', () => {
  it('lets a brand-new, empty, single-sign-in account go', () => {
    expect(discardRefusal(fresh, now)).toBeNull();
  });

  it('refuses anything that could lose something', () => {
    expect(discardRefusal({ ...fresh, createdAt: new Date('2026-10-25T11:00:00Z') }, now)).toMatch(/made today/);
    expect(discardRefusal({ ...fresh, stripeCustomerId: 'cus_123' }, now)).toMatch(/billing/);
    expect(discardRefusal({ ...fresh, signInMethods: 2 }, now)).toMatch(/more than one/);
    expect(discardRefusal({ ...fresh, signInMethods: 0 }, now)).toMatch(/more than one/);
    expect(discardRefusal({ ...fresh, ownedRows: 1 }, now)).toMatch(/already has things/);
  });
});
