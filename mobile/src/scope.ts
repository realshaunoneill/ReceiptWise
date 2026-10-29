import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { LEGACY_SLOT } from './auth/account-list';
import { activeSlot, subscribeAccounts } from './auth/accounts';
import { useMe } from './hooks/useMe';

/**
 * Whose money is on screen: your own ("Just me"), or a household's. One choice for Home and the
 * Plan, as the website keeps it in the URL; kept on the phone for each account signed in on it,
 * and forgotten when that account signs out.
 */

const KEY = 'receiptwise_scopes';
/** From before there were several accounts: one household id, the first account's. */
const LEGACY_KEY = 'receiptwise_scope';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Each account's household in view, by slot (src/auth/accounts.ts). */
let scopes: Record<string, string> = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const save = () => void AsyncStorage.setItem(KEY, JSON.stringify(scopes)).catch(() => undefined);
const without = (slot: string) => Object.fromEntries(Object.entries(scopes).filter(([key]) => key !== slot));

// Storage outlives app versions, so only well-formed ids are taken from it.
void AsyncStorage.multiGet([KEY, LEGACY_KEY]).then(([[, stored], [, legacy]]) => {
  try {
    const parsed = stored ? (JSON.parse(stored) as Record<string, unknown>) : {};
    for (const [slot, id] of Object.entries(parsed ?? {})) if (typeof id === 'string' && UUID.test(id)) scopes[slot] = id;
  } catch {
    scopes = {};
  }
  if (legacy) {
    if (UUID.test(legacy) && !scopes[LEGACY_SLOT]) scopes[LEGACY_SLOT] = legacy;
    save();
    void AsyncStorage.removeItem(LEGACY_KEY).catch(() => undefined);
  }
  emit();
}).catch(() => undefined);

/** The household in view for the account on screen. */
export function setScope(householdId: string | null) {
  const slot = activeSlot();
  if (!slot) return;
  scopes = householdId ? { ...scopes, [slot]: householdId } : without(slot);
  emit();
  save();
}

/** An account signed out: its choice goes with it. */
export function forgetScope(slot: string) {
  if (!(slot in scopes)) return;
  scopes = without(slot);
  emit();
  save();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const accounts = subscribeAccounts(listener);
  return () => {
    listeners.delete(listener);
    accounts();
  };
};
const read = () => scopes[activeSlot() ?? ''] ?? null;

/**
 * The household in view, or undefined for your own. Only a household whose plan you can see
 * (someone in it has Premium) counts: after leaving one, or its Premium lapsing, you're back to
 * your own.
 */
export function useScope(): { householdId: string | undefined; setScope: typeof setScope } {
  const stored = useSyncExternalStore(subscribe, read, read);
  const me = useMe();
  const allowed = !!stored && !!me.data?.entitlements.householdIds.includes(stored);
  return { householdId: allowed ? stored : undefined, setScope };
}
