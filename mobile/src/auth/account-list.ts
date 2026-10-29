/**
 * The accounts signed in on this phone or iPad, as a pure list: src/auth/accounts.ts keeps it on
 * the device. A household sharing one iPad signs each person in, and one account is on screen at a
 * time; each keeps a session of its own.
 *
 * An account is known by its slot, which names where its session cookie is kept. The account from
 * before there were several keeps the original keys (LEGACY_SLOT), so updating the app keeps
 * everyone signed in with their cached data.
 */

export type Account = {
  slot: string;
  /** auth_user.id, from the session: the same person signing in again is the same account. */
  authUserId?: string;
  /** users.id, which notifications and in-app purchases are keyed by. */
  userId?: string;
  name?: string;
  email?: string;
  image?: string | null;
};

export type AccountList = { active: string | null; accounts: Account[] };

export const LEGACY_SLOT = '0';
export const NO_ACCOUNTS: AccountList = { active: null, accounts: [] };

const SLOT = /^[A-Za-z0-9]{1,32}$/;

/** A stored list, treating anything unreadable as no accounts. */
export function parseAccountList(stored: string | null): AccountList {
  if (!stored) return NO_ACCOUNTS;
  try {
    const parsed = JSON.parse(stored) as Partial<AccountList> | null;
    const accounts = Array.isArray(parsed?.accounts)
      ? parsed.accounts.filter((account): account is Account => !!account && typeof account.slot === 'string' && SLOT.test(account.slot))
      : [];
    const active = accounts.some((account) => account.slot === parsed?.active) ? parsed!.active! : accounts[0]?.slot ?? null;
    return { active, accounts };
  } catch {
    return NO_ACCOUNTS;
  }
}

/**
 * A sign-in finished, its session kept in a new slot. Someone already on the device signing in
 * again stays the account they were, in their own slot (with its cached data), and `existing` says
 * the new session belongs there instead. The active account doesn't change here; signing in
 * finishes with withActive.
 */
export function withSignIn(list: AccountList, account: Account): { list: AccountList; slot: string; existing: boolean } {
  const existing = account.authUserId ? list.accounts.find((entry) => entry.authUserId === account.authUserId) : undefined;
  if (!existing) return { list: { ...list, accounts: [...list.accounts, account] }, slot: account.slot, existing: false };
  const { slot: _new, ...identity } = account;
  return { list: withIdentity(list, existing.slot, identity), slot: existing.slot, existing: true };
}

/** Put this account on screen. */
export function withActive(list: AccountList, slot: string): AccountList {
  return list.accounts.some((account) => account.slot === slot) ? { ...list, active: slot } : list;
}

/** Signed out of one account: the first of the rest (if any) is on screen next. */
export function withoutAccount(list: AccountList, slot: string): AccountList {
  if (!list.accounts.some((account) => account.slot === slot)) return list;
  const accounts = list.accounts.filter((account) => account.slot !== slot);
  const active = list.active === slot ? accounts[0]?.slot ?? null : list.active;
  return { active, accounts };
}

/** What the server says about an account now: its name, email, picture and ids. */
export function withIdentity(list: AccountList, slot: string, identity: Omit<Partial<Account>, 'slot'>): AccountList {
  let changed = false;
  const accounts = list.accounts.map((account) => {
    if (account.slot !== slot) return account;
    const next = { ...account, ...identity };
    changed = (Object.keys(identity) as (keyof typeof identity)[]).some((key) => account[key] !== next[key]);
    return next;
  });
  return changed ? { ...list, accounts } : list;
}

/** The account a notification is for, from its users.id. */
export function accountForUser(list: AccountList, userId: string): Account | undefined {
  return list.accounts.find((account) => account.userId === userId);
}

export function activeAccount(list: AccountList): Account | undefined {
  return list.accounts.find((account) => account.slot === list.active);
}

/** "Megan", or the start of the email address for an account without a name. */
export function firstName(account: Pick<Account, 'name' | 'email'>): string {
  return account.name?.trim().split(/\s+/)[0] || account.email?.split('@')[0] || 'Account';
}
