import { describe, expect, it } from 'vitest';

import { accountForUser, firstName, LEGACY_SLOT, NO_ACCOUNTS, parseAccountList, withActive, withIdentity, withoutAccount, withSignIn, type AccountList } from './account-list';

const shaun = { slot: LEGACY_SLOT, authUserId: 'auth-shaun', userId: 'user-shaun', name: "Shaun O'Neill", email: 'shaun@example.com' };
const megan = { slot: 'b7k2', authUserId: 'auth-megan', name: 'Megan Kavanagh', email: 'megan@example.com' };
const twoAccounts: AccountList = { active: LEGACY_SLOT, accounts: [shaun, megan] };

describe('parseAccountList', () => {
  it('reads what was stored', () => {
    expect(parseAccountList(JSON.stringify(twoAccounts))).toEqual(twoAccounts);
  });

  it('treats nothing, or anything unreadable, as no accounts', () => {
    expect(parseAccountList(null)).toEqual(NO_ACCOUNTS);
    expect(parseAccountList('{nope')).toEqual(NO_ACCOUNTS);
    expect(parseAccountList('[]')).toEqual(NO_ACCOUNTS);
  });

  it('drops entries with a slot that could not name a key', () => {
    const stored = { active: LEGACY_SLOT, accounts: [shaun, { slot: '../x' }, { name: 'no slot' }] };
    expect(parseAccountList(JSON.stringify(stored)).accounts).toEqual([shaun]);
  });

  it('puts the first account on screen when the active one is missing', () => {
    expect(parseAccountList(JSON.stringify({ active: 'gone', accounts: [megan] })).active).toBe('b7k2');
    expect(parseAccountList(JSON.stringify({ active: 'gone', accounts: [] })).active).toBeNull();
  });
});

describe('withSignIn', () => {
  it('adds someone new without changing who is on screen', () => {
    const { list, slot, existing } = withSignIn({ active: LEGACY_SLOT, accounts: [shaun] }, megan);
    expect(list).toEqual(twoAccounts);
    expect(slot).toBe('b7k2');
    expect(existing).toBe(false);
  });

  it('keeps someone already here in their own slot, with what the new sign-in says', () => {
    const { list, slot, existing } = withSignIn(twoAccounts, { slot: 'n3w', authUserId: 'auth-megan', name: 'Megan K', email: 'megan@example.com' });
    expect(slot).toBe('b7k2');
    expect(existing).toBe(true);
    expect(list.accounts).toHaveLength(2);
    expect(list.accounts[1]).toMatchObject({ slot: 'b7k2', name: 'Megan K' });
  });
});

describe('withoutAccount', () => {
  it('puts the next account on screen after signing out of the one shown', () => {
    expect(withoutAccount(twoAccounts, LEGACY_SLOT)).toEqual({ active: 'b7k2', accounts: [megan] });
  });

  it('leaves the one on screen when another signs out', () => {
    expect(withoutAccount(twoAccounts, 'b7k2')).toEqual({ active: LEGACY_SLOT, accounts: [shaun] });
  });

  it('changes nothing for an account already gone', () => {
    expect(withoutAccount(twoAccounts, 'gone')).toBe(twoAccounts);
  });

  it('has nobody on screen after the last', () => {
    expect(withoutAccount({ active: LEGACY_SLOT, accounts: [shaun] }, LEGACY_SLOT)).toEqual(NO_ACCOUNTS);
  });
});

describe('withActive and withIdentity', () => {
  it('switches only to an account that is here', () => {
    expect(withActive(twoAccounts, 'b7k2').active).toBe('b7k2');
    expect(withActive(twoAccounts, 'gone')).toBe(twoAccounts);
  });

  it('keeps the same list when nothing changed, so nothing re-renders', () => {
    expect(withIdentity(twoAccounts, LEGACY_SLOT, { name: "Shaun O'Neill" })).toBe(twoAccounts);
    expect(withIdentity(twoAccounts, 'b7k2', { userId: 'user-megan' }).accounts[1].userId).toBe('user-megan');
  });
});

describe('accountForUser and firstName', () => {
  it('finds whose a notification is', () => {
    expect(accountForUser(twoAccounts, 'user-shaun')?.slot).toBe(LEGACY_SLOT);
    expect(accountForUser(twoAccounts, 'user-nobody')).toBeUndefined();
  });

  it('names an account by its first name, or its email', () => {
    expect(firstName(megan)).toBe('Megan');
    expect(firstName({ name: '', email: 'shaun@example.com' })).toBe('shaun');
  });
});
