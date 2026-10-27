import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

/**
 * expo-notifications and expo-device, only in builds that have them: the preview build installed
 * before push was added hasn't got their native modules, and importing them there would crash the
 * app at launch. Null in those builds and in the web preview, where push does nothing.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const Notifications = Platform.OS !== 'web' && requireOptionalNativeModule('ExpoPushTokenManager') ? (require('expo-notifications') as typeof import('expo-notifications')) : null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const Device = Platform.OS !== 'web' && requireOptionalNativeModule('ExpoDevice') ? (require('expo-device') as typeof import('expo-device')) : null;
