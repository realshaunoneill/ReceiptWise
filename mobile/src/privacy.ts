import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/**
 * Privacy settings kept on this phone (not the account): hide amounts, for showing someone the
 * screen, and app lock (Face ID or the fingerprint, src/components/AppLock.tsx). The website has
 * its own hide amounts, per browser, for the same reason.
 */
export type PrivacySettings = { hideAmounts: boolean; appLock: boolean };

const KEY = 'receiptwise_privacy';
let current: PrivacySettings = { hideAmounts: false, appLock: false };
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

const ready = AsyncStorage.getItem(KEY).then((stored) => {
  try {
    const parsed = stored ? (JSON.parse(stored) as Partial<PrivacySettings>) : {};
    // Storage outlives app versions: only booleans are taken from it.
    current = { hideAmounts: parsed.hideAmounts === true, appLock: parsed.appLock === true };
  } catch {
    // Unreadable: the defaults.
  }
}).catch(() => undefined).finally(() => {
  loaded = true;
  emit();
});

/** Resolves once the stored settings are read: app lock must know before the first frame. */
export const privacyReady = () => ready;
export const privacyLoaded = () => loaded;

export function setPrivacy(change: Partial<PrivacySettings>) {
  current = { ...current, ...change };
  emit();
  void AsyncStorage.setItem(KEY, JSON.stringify(current)).catch(() => undefined);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const read = () => current;

export function usePrivacy(): PrivacySettings {
  return useSyncExternalStore(subscribe, read, read);
}

/** Whether the stored settings have been read (the root layout holds the splash until then). */
export function usePrivacyLoaded(): boolean {
  return useSyncExternalStore(subscribe, privacyLoaded, privacyLoaded);
}

// An amount as the app writes them: a currency (€, £, US$, CHF, SEK…) next to a number, or a
// number with a currency after it (12,50 kr). Plain numbers and dates aren't touched.
const AMOUNT = /(?:[A-Z]{2,3}\s?|[A-Z]{0,2}[$€£¥₹])\s?-?\d[\d,.  ]*\d|\d[\d,.  ]*\d\s?(?:kr|zł|€|Kč|Ft|lei)\b/g;

/** "€179.73 left" → "€••• left": the amounts in a line of text, masked. */
export function maskAmounts(text: string): string {
  return text.replace(AMOUNT, (match) => match.replace(/-?\d[\d,.  ]*\d/, '•••'));
}
