import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, onlineManager, QueryClient, type Query } from '@tanstack/react-query';
import { type PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import * as Application from 'expo-application';
import { AppState, Platform } from 'react-native';
import { ApiError } from '../api/errors';
import { LEGACY_SLOT } from '../auth/account-list';

/**
 * Data fetching, as on the website (lib/providers/query-provider.tsx): what you change refreshes at
 * once (each mutation waits for its refresh, shared/query/refresh.ts), and coming back to the app
 * looks again at anything over 15 seconds old, so a receipt clipped or forwarded elsewhere, or a
 * partner's change, shows up.
 */

/** Errors a retry can't fix: answer at once rather than three times slower. */
const FINAL: ApiError['kind'][] = ['signed-out', 'premium-required', 'deletion-pending', 'suspended', 'forbidden', 'not-found', 'invalid'];

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 1000,
      // Kept a day, so what was persisted is there to show while the app looks again.
      gcTime: 24 * 60 * 60 * 1000,
      retry: (count, error) => !(error instanceof ApiError && FINAL.includes(error.kind)) && count < 2,
    },
  },
});

// "Window focus" in an app is coming back to the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
  onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)));
}

/**
 * What's kept on the phone between launches, so the app opens on last-known figures rather than
 * spinners: the account, the plan's current period, the first receipts and recent receipt details.
 * Kept for each account signed in on the device, so switching between them opens on figures too;
 * cleared when that account signs out, and whenever the app's version changes.
 */
const PERSISTED = new Set(['me', 'plan', 'receipts', 'receipt', 'subscriptions', 'households']);

/** The first account keeps the key from before there were several. */
const cacheKey = (slot: string | null) => (slot === LEGACY_SLOT ? 'receiptwise_query_cache' : `receiptwise_query_cache_${slot ?? 'signed_out'}`);

type PersistOptions = Omit<PersistQueryClientOptions, 'queryClient'>;
const options = new Map<string | null, PersistOptions>();

/**
 * For app/_layout.tsx's PersistQueryClientProvider: one account's saved queries (nothing is saved
 * signed out). The same object each time for an account, since a new one would restore again.
 */
export function persistOptionsFor(slot: string | null): PersistOptions {
  let found = options.get(slot);
  if (!found) {
    found = {
      persister: createAsyncStoragePersister({ storage: AsyncStorage, key: cacheKey(slot) }),
      maxAge: 7 * 24 * 60 * 60 * 1000,
      buster: Application.nativeApplicationVersion ?? 'dev',
      dehydrateOptions: {
        shouldDehydrateQuery: (query: Query) =>
          slot !== null && query.state.status === 'success' && PERSISTED.has(String(query.queryKey[0])) && (query.queryKey[0] !== 'plan' || query.queryKey[1] === 0),
      },
    };
    options.set(slot, found);
  }
  return found;
}

/** An account signed out: what was saved of its data goes. */
export async function removeSavedQueries(slot: string): Promise<void> {
  options.delete(slot);
  const remove = () => AsyncStorage.removeItem(cacheKey(slot)).catch(() => undefined);
  await remove();
  // Again once the persister's last throttled write (a second behind) can't put it back.
  setTimeout(() => void remove(), 2500);
}
