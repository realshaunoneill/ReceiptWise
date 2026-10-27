import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * The app's native config. One bundle id for every build profile (development, preview,
 * production): the server trusts it for Sign in with Apple, app links and, later, push and the
 * stores' purchases, so separate variants would multiply all of those.
 *
 * Icons and the splash image are drawn from brand/mark.svg once the mark is approved; until then
 * builds use Expo's defaults.
 */
const CAMERA_PERMISSION = "ReceiptWise uses the camera to scan receipts and bills. They're uploaded to your account so they can be read.";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'ReceiptWise',
  slug: 'receiptwise',
  owner: 'realshaunoneill',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'receiptwise',
  userInterfaceStyle: 'automatic',
  runtimeVersion: { policy: 'fingerprint' },
  // EAS Update: JS-only changes reach installed builds with `eas update --channel <profile's channel>`.
  // The fingerprint runtime means an update only goes to builds with the same native code.
  updates: { url: 'https://u.expo.dev/db151b22-b7bd-4259-9a69-a4e2767741f3' },
  ios: {
    bundleIdentifier: 'io.receiptwise.app',
    supportsTablet: false,
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'io.receiptwise.app',
    // Receipts and the session stay off Google's backups.
    allowBackup: false,
    predictiveBackGestureEnabled: false,
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.RECORD_AUDIO',
    ],
  },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { backgroundColor: '#F2EFEA', dark: { backgroundColor: '#090A0D' } }],
    'expo-status-bar',
    'expo-web-browser',
    'expo-secure-store',
    'expo-font',
    'expo-localization',
    'expo-image',
    'expo-apple-authentication',
    [
      'expo-image-picker',
      {
        // Photos are chosen with the system picker, which needs no access to the library.
        photosPermission: false,
        cameraPermission: CAMERA_PERMISSION,
        microphonePermission: false,
      },
    ],
    // VisionKit on iOS, ML Kit on Android (which needs Play services; without them the camera is used).
    ['react-native-document-scanner-plugin', { cameraPermission: CAMERA_PERMISSION }],
    '@react-native-community/datetimepicker',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    // The EAS project (builds, credentials and later updates), created by Shaun on 2026-10-27.
    eas: { projectId: 'db151b22-b7bd-4259-9a69-a4e2767741f3' },
  },
});
