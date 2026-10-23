import { describe, expect, it } from 'vitest';
import { canOwnFinanceRow, canReadFinanceRow, hasAnyFinanceAccess } from './finance-access';

const me = 'user-me';
const partner = 'user-partner';
const home = 'household-home';
const other = 'household-other';

describe('finance access', () => {
  const paying = { personal: true, householdIds: [home] };
  const coveredByHousehold = { personal: false, householdIds: [home] };
  const nothing = { personal: false, householdIds: [] };

  it('lets a subscriber read and own their own rows', () => {
    const personalRow = { userId: me, householdId: null };
    expect(canReadFinanceRow(personalRow, me, paying)).toBe(true);
    expect(canOwnFinanceRow(personalRow, me, paying)).toBe(true);
  });

  it("lets a household member read, but not own, someone else's shared row", () => {
    const shared = { userId: partner, householdId: home };
    expect(canReadFinanceRow(shared, me, coveredByHousehold)).toBe(true);
    expect(canOwnFinanceRow(shared, me, coveredByHousehold)).toBe(false);
  });

  it('keeps personal rows behind your own Premium', () => {
    const personalRow = { userId: me, householdId: null };
    expect(canReadFinanceRow(personalRow, me, coveredByHousehold)).toBe(false);
    // Your own row shared with a covered household stays yours to manage.
    expect(canOwnFinanceRow({ userId: me, householdId: home }, me, coveredByHousehold)).toBe(true);
  });

  it('never exposes rows from a household you are not covered in', () => {
    expect(canReadFinanceRow({ userId: partner, householdId: other }, me, paying)).toBe(false);
    expect(canReadFinanceRow({ userId: partner, householdId: null }, me, paying)).toBe(false);
  });

  it('knows when someone has no finance access at all', () => {
    expect(hasAnyFinanceAccess(nothing)).toBe(false);
    expect(hasAnyFinanceAccess(coveredByHousehold)).toBe(true);
  });
});
