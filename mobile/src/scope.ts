import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { useMe } from './hooks/useMe';

/**
 * Whose money is on screen: your own ("Just me"), or a household's. One choice for Home and the
 * Plan, as the website keeps it in the URL; kept on the phone, and forgotten on sign-out.
 */

const KEY = 'receiptwise_scope';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let current: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

// Storage outlives app versions, so only a well-formed id is taken from it.
void AsyncStorage.getItem(KEY).then((stored) => {
  if (stored && UUID.test(stored)) {
    current = stored;
    emit();
  }
}).catch(() => undefined);

export function setScope(householdId: string | null) {
  current = householdId;
  emit();
  void (householdId ? AsyncStorage.setItem(KEY, householdId) : AsyncStorage.removeItem(KEY)).catch(() => undefined);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const read = () => current;

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
