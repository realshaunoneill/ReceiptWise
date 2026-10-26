import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, onlineManager, QueryClient, type Query } from '@tanstack/react-query';
import * as Application from 'expo-application';
import { AppState, Platform } from 'react-native';
import { ApiError } from '../api/errors';

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
 * Cleared on sign-out and whenever the app's version changes.
 */
const PERSISTED = new Set(['me', 'plan', 'receipts', 'receipt', 'subscriptions', 'households']);

export const persistOptions = {
  persister: createAsyncStoragePersister({ storage: AsyncStorage, key: 'receiptwise_query_cache' }),
  maxAge: 7 * 24 * 60 * 60 * 1000,
  buster: Application.nativeApplicationVersion ?? 'dev',
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) =>
      query.state.status === 'success' && PERSISTED.has(String(query.queryKey[0])) && (query.queryKey[0] !== 'plan' || query.queryKey[1] === 0),
  },
};
