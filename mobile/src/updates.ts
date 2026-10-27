import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

/**
 * expo-updates, only where it exists: a build made before it was added hasn't got its native
 * module, and importing it there crashed the app at launch. The web preview has its own version.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const Updates = Platform.OS === 'web' || requireOptionalNativeModule('ExpoUpdates') ? (require('expo-updates') as typeof import('expo-updates')) : null;
