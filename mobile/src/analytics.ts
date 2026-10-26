import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

/**
 * Analytics consent, as on the website (lib/analytics/consent.ts): nothing is measured until the
 * person says yes, and they can change their mind in Settings. The choice goes to the server as
 * the same `rw-analytics-consent` cookie the website sets, on every request
 * (src/auth/auth.ts authHeaders), so server-side capture (lib/posthog-server.ts) honours it.
 *
 * The app has no analytics SDK of its own yet; when one is added (posthog-react-native, behind
 * EXPO_PUBLIC_POSTHOG_KEY), it starts only when this says granted.
 */

export type ConsentChoice = 'granted' | 'denied';

export const CONSENT_COOKIE = 'rw-analytics-consent';
const KEY = 'receiptwise_analytics_consent';

let current: ConsentChoice | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

// Storage outlives app versions: only the two known values are taken from it.
void AsyncStorage.getItem(KEY).then((stored) => {
  if (stored === 'granted' || stored === 'denied') {
    current = stored;
    emit();
  }
}).catch(() => undefined);

/** The choice made, or null before one is. Read synchronously by every request. */
export function getConsent(): ConsentChoice | null {
  return current;
}

export function setConsent(choice: ConsentChoice) {
  current = choice;
  emit();
  void AsyncStorage.setItem(KEY, choice).catch(() => undefined);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useConsent(): ConsentChoice | null {
  return useSyncExternalStore(subscribe, getConsent, getConsent);
}
