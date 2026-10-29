import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Localization from 'expo-localization';
import { Platform } from 'react-native';
import { FINANCE_QUERY_KEYS } from '@shared/query/keys';
import { invalidateReceiptQueries, refreshQueries } from '@shared/query/refresh';
import { api } from '../api/client';
import { accountForUser } from '../auth/account-list';
import { activeSlot, getAccounts, updateAccount } from '../auth/accounts';
import { queryClient } from '../query/client';
import { Device, Notifications } from './native';

/**
 * The phone's side of push notifications (the server's is lib/push): permission, the Expo push
 * token registered with POST /api/devices on every launch (with the time zone, so the 9 am round
 * and quiet hours are the person's own), and forgotten again on sign-out. A phone or iPad signed in
 * to several accounts (a household's) registers for each, so everyone gets their own; each
 * notification says whose it is (data.userId), and src/push/PushEffects.tsx opens it as them.
 *
 * What's sent, and the copy, is the server's (lib/push/messages.ts). Every notification carries a
 * website path in data.url, which src/links.ts turns into a screen.
 */

export type PushPermission = 'unavailable' | 'granted' | 'denied' | 'undetermined';

const TOKEN_KEY = 'receiptwise_push_token';
const PRIMED_KEY = 'receiptwise_push_primed';

/** Android's channels, one per kind of notification (lib/push/messages.ts KIND_CHANNEL). */
const CHANNELS = [
  { id: 'receipts', name: 'Receipts read' },
  { id: 'bills', name: 'Bills and the plan' },
  { id: 'household', name: 'Households' },
  { id: 'account', name: 'Premium' },
] as const;

const RECEIPT_KINDS = new Set(['receipt_read', 'receipt_failed']);

/** Whether a notification is for someone other than the person on screen. */
export function isForAnotherAccount(userId: unknown): boolean {
  if (typeof userId !== 'string') return false;
  return accountForUser(getAccounts(), userId)?.slot !== activeSlot();
}

/** What a notification is about is probably on screen somewhere: refresh it (unless it's someone else's). */
function refreshFor(kind: unknown, userId: unknown) {
  if (typeof kind !== 'string' || isForAnotherAccount(userId)) return;
  if (RECEIPT_KINDS.has(kind)) void invalidateReceiptQueries(queryClient);
  else if (kind.startsWith('bill') || kind === 'payday') void refreshQueries(queryClient, ['bill-documents', ...FINANCE_QUERY_KEYS]);
  else if (kind === 'invite_received' || kind === 'member_joined') void refreshQueries(queryClient, ['invitations', 'households']);
  else void queryClient.invalidateQueries({ queryKey: ['me'] });
}

let configured = false;

/**
 * How a notification behaves with the app open: a receipt that was just read doesn't need a
 * banner over the screen showing it, so its lists refresh instead; the rest show as usual.
 */
export async function configurePush(): Promise<void> {
  if (!Notifications || configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const { kind, userId } = notification.request.content.data ?? {};
      refreshFor(kind, userId);
      const quiet = typeof kind === 'string' && RECEIPT_KINDS.has(kind);
      return { shouldShowBanner: !quiet, shouldShowList: !quiet, shouldPlaySound: !quiet, shouldSetBadge: false };
    },
  });
  if (Platform.OS === 'android') {
    for (const channel of CHANNELS) {
      await Notifications.setNotificationChannelAsync(channel.id, { name: channel.name, importance: Notifications.AndroidImportance.DEFAULT });
    }
  }
}

export async function pushPermission(): Promise<PushPermission> {
  if (!Notifications) return 'unavailable';
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

const projectId = () => (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? Constants.easConfig?.projectId;

/**
 * Register this phone for notifications. With `ask`, the system's permission prompt shows if it
 * hasn't been answered (only ever after the priming sheet or from Settings, never on launch).
 * Returns the permission as it stands afterwards.
 */
export async function registerPush({ ask }: { ask: boolean }): Promise<PushPermission> {
  if (!Notifications) return 'unavailable';
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted' && ask && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== 'granted') return permission.status === 'denied' ? 'denied' : 'undetermined';
  // A simulator has no push token.
  if (Device && !Device.isDevice) return 'granted';
  await configurePush();
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
  const device = {
    token,
    platform: Platform.OS === 'android' ? 'android' : 'ios',
    appVersion: Application.nativeApplicationVersion ?? undefined,
    locale: Localization.getLocales()[0]?.languageTag,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  // The person on screen first, whose failure is worth showing; then everyone else signed in here.
  const register = async (slot: string) => {
    const { userId } = await api<{ userId?: string }>('/api/devices', { method: 'POST', json: device, account: slot });
    if (userId) updateAccount(slot, { userId });
  };
  const active = activeSlot();
  if (active) await register(active);
  for (const account of getAccounts().accounts) {
    if (account.slot !== active) await register(account.slot).catch(() => undefined);
  }
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return 'granted';
}

/**
 * Signing out of an account: this phone stops getting its notifications, while any other account
 * signed in here keeps getting theirs. Best effort; called while the account's session still works.
 */
export async function unregisterPush(slot: string, lastAccount: boolean): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (!token) return;
  await api(`/api/devices/${encodeURIComponent(token)}`, { method: 'DELETE', account: slot }).catch(() => undefined);
  if (lastAccount) await AsyncStorage.removeItem(TOKEN_KEY).catch(() => undefined);
}

/**
 * Whether to offer notifications now (after the first capture): only if the prompt has never
 * been answered and the priming sheet hasn't been shown before.
 */
export async function shouldOfferPush(): Promise<boolean> {
  if (!Notifications) return false;
  if ((await AsyncStorage.getItem(PRIMED_KEY).catch(() => '1')) === '1') return false;
  return (await pushPermission()) === 'undetermined';
}

export async function markPushOffered(): Promise<void> {
  await AsyncStorage.setItem(PRIMED_KEY, '1').catch(() => undefined);
}
