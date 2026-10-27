import { NativeModules, Platform } from 'react-native';
import { queryClient } from '../query/client';

/**
 * Premium bought in the app, through the App Store or Google Play, by way of RevenueCat. The app
 * identifies each person to RevenueCat by their users.id, so the website (lib/revenuecat.ts) can
 * look their purchases up; it configures only once someone is signed in, and logs out with them.
 *
 * Off where it can't work: in the web preview, without this platform's key
 * (EXPO_PUBLIC_REVENUECAT_IOS_KEY / _ANDROID_KEY, set on EAS once RevenueCat exists), or in a build
 * from before react-native-purchases was added (its native module is missing). Screens check
 * `purchasesAvailable` and show the usual "Premium isn't on this account" notice instead.
 */

type PurchasesModule = typeof import('react-native-purchases');

const KEY = Platform.select({ ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY });

// An old-style React Native module, so Expo's requireOptionalNativeModule can't see it.
export const purchasesAvailable = Platform.OS !== 'web' && !!KEY && !!NativeModules.RNPurchases;

let loaded: PurchasesModule | null = null;
/** The library, only where it's available (on the web it would load RevenueCat's web billing). */
export function purchasesModule(): PurchasesModule | null {
  if (!purchasesAvailable) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  loaded ??= require('react-native-purchases') as PurchasesModule;
  return loaded;
}

let configured = false;
let currentUser: string | null = null;

/** Tell RevenueCat who's signed in: purchases are then theirs, under their users.id. */
export async function configurePurchases(userId: string): Promise<void> {
  const module = purchasesModule();
  if (!module || currentUser === userId) return;
  if (!configured) {
    module.default.configure({ apiKey: KEY!, appUserID: userId });
    configured = true;
  } else {
    await module.default.logIn(userId);
  }
  currentUser = userId;
  // Offerings belong to the person (trial eligibility does), so look again.
  void queryClient.invalidateQueries({ queryKey: ['offerings'] });
}

/** Signed out: the next person mustn't inherit these purchases. */
export async function resetPurchases(): Promise<void> {
  const module = purchasesModule();
  if (!module || !configured || !currentUser) return;
  currentUser = null;
  await module.default.logOut().catch(() => undefined);
}

export function purchasesUser(): string | null {
  return currentUser;
}
