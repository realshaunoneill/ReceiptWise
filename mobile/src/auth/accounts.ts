import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { type Account, type AccountList, LEGACY_SLOT, NO_ACCOUNTS, parseAccountList, withActive, withIdentity, withoutAccount, withSignIn } from './account-list';
import { cookieHeader, parseJar, type CookieJar } from './cookies';

/**
 * The accounts signed in on this device (src/auth/account-list.ts), kept in SecureStore: the list
 * (who they are, and which is on screen), and each account's session cookie under a key of its own,
 * since SecureStore can refuse a value over 2 KB on some Android versions. Read once at launch and
 * held in memory after that, so a request doesn't read the keychain each time.
 *
 * The web preview can hold only the browser's own cookie (src/auth/auth.ts), so there it is one
 * account at most, in LEGACY_SLOT.
 */

const IS_WEB = Platform.OS === 'web';
const LIST_KEY = 'receiptwise_accounts';
/** Readable after the first unlock, so a background upload can still send the session. */
const STORE_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

/** Where an account's session is kept: the first account keeps the key from before there were several. */
const jarKey = (slot: string) => (slot === LEGACY_SLOT ? 'receiptwise_auth_cookies' : `receiptwise_auth_cookies_${slot}`);

// The web preview starts as if signed in and asks the server (src/hooks/useSession.ts).
let list: AccountList = IS_WEB ? { active: LEGACY_SLOT, accounts: [{ slot: LEGACY_SLOT }] } : NO_ACCOUNTS;
const jars = new Map<string, CookieJar>();
let loading: Promise<void> | null = null;
let loaded = IS_WEB;
let writing: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();

async function read(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, STORE_OPTIONS);
  } catch {
    return null;
  }
}

/** Stored in order, each write the latest list, so a quick switch and sign-out can't land backwards. */
function writeList() {
  if (IS_WEB) return;
  writing = writing.then(() => SecureStore.setItemAsync(LIST_KEY, JSON.stringify(list), STORE_OPTIONS)).catch(() => undefined);
}

function writeJar(slot: string, jar: CookieJar) {
  if (IS_WEB) return;
  const key = jarKey(slot);
  writing = writing.then(() => (Object.keys(jar).length === 0 ? SecureStore.deleteItemAsync(key, STORE_OPTIONS) : SecureStore.setItemAsync(key, JSON.stringify(jar), STORE_OPTIONS))).catch(() => undefined);
}

function commit(next: AccountList) {
  if (next === list) return;
  list = next;
  writeList();
  for (const listener of listeners) listener();
}

/** Read the accounts once, at launch (app/_layout.tsx waits for it, behind the splash). */
export function loadAccounts(): Promise<void> {
  loading ??= (async () => {
    if (IS_WEB) return;
    const stored = await read(LIST_KEY);
    let next = parseAccountList(stored);
    if (stored === null) {
      // From before there were several accounts: one session, under the original key.
      const legacy = parseJar(await read(jarKey(LEGACY_SLOT)));
      if (cookieHeader(legacy)) next = { active: LEGACY_SLOT, accounts: [{ slot: LEGACY_SLOT }] };
    }
    for (const account of next.accounts) jars.set(account.slot, parseJar(await read(jarKey(account.slot))));
    list = next;
    if (stored === null && next.accounts.length > 0) writeList();
  })().finally(() => {
    loaded = true;
    for (const listener of listeners) listener();
  });
  return loading;
}

export function subscribeAccounts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getAccounts = (): AccountList => list;
export const activeSlot = (): string | null => list.active;
const isLoaded = () => loaded;

export function useAccounts(): AccountList {
  return useSyncExternalStore(subscribeAccounts, getAccounts, getAccounts);
}

export function useAccountsLoaded(): boolean {
  return useSyncExternalStore(subscribeAccounts, isLoaded, isLoaded);
}

/** An account's session cookies (empty for one that has none). */
export function sessionJar(slot: string): CookieJar {
  return jars.get(slot) ?? {};
}

export function saveSessionJar(slot: string, jar: CookieJar) {
  if (IS_WEB) return;
  jars.set(slot, jar);
  writeJar(slot, jar);
}

/** Where a sign-in keeps its session until it's known whose it is (src/auth/auth.ts finishSignIn). */
export function newSlot(): string {
  return Crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

/**
 * A sign-in finished, its session in `account.slot`. Someone already on the device stays in their
 * own slot, which takes the new session. Returns the account's slot; it isn't on screen until
 * setActiveAccount, so the sign-in screen can still ask its last question first.
 */
export function addAccount(account: Account): string {
  if (IS_WEB) {
    commit({ active: list.active, accounts: [{ ...account, slot: LEGACY_SLOT }] });
    return LEGACY_SLOT;
  }
  const { list: next, slot, existing } = withSignIn(list, account);
  if (existing) {
    saveSessionJar(slot, sessionJar(account.slot));
    jars.delete(account.slot);
    writeJar(account.slot, {});
  }
  commit(next);
  return slot;
}

/** Put an account on screen: app/_layout.tsx shows the app afresh, as that account. */
export function setActiveAccount(slot: string) {
  commit(withActive(list, slot));
}

/** Forget an account and its session here; the next one, if any, goes on screen. */
export function removeAccount(slot: string) {
  commit(withoutAccount(list, slot));
  jars.delete(slot);
  writeJar(slot, {});
}

/** What the server says about an account now (its name, email, picture and ids). */
export function updateAccount(slot: string, identity: Omit<Partial<Account>, 'slot'>) {
  commit(withIdentity(list, slot, identity));
}
