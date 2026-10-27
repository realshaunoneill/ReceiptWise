import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * The app's native config. One bundle id for every build profile (development, preview,
 * production): the server trusts it for Sign in with Apple, app links and, later, push and the
 * stores' purchases, so separate variants would multiply all of those.
 *
 * Icons and the splash image are drawn from brand/mark.svg by scripts/brand-assets.py (approved
 * 2026-10-27); an icon change is native, so it needs a new build, not an update.
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
  icon: './assets/icon.png',
  runtimeVersion: { policy: 'fingerprint' },
  // EAS Update: JS-only changes reach installed builds with `eas update --channel <profile's channel>`.
  // The fingerprint runtime means an update only goes to builds with the same native code.
  updates: { url: 'https://u.expo.dev/db151b22-b7bd-4259-9a69-a4e2767741f3' },
  ios: {
    bundleIdentifier: 'io.receiptwise.app',
    // iOS 18's light, dark and tinted home-screen icons.
    icon: { light: './assets/icon.png', dark: './assets/icon-dark.png', tinted: './assets/icon-tinted.png' },
    supportsTablet: false,
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'io.receiptwise.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/adaptive-icon-monochrome.png',
      backgroundColor: '#F2EFEA',
    },
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
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 140,
        backgroundColor: '#F2EFEA',
        dark: { image: './assets/splash-icon-dark.png', backgroundColor: '#090A0D' },
      },
    ],
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
  web: { favicon: './assets/favicon.png' },
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    // The EAS project (builds, credentials and later updates), created by Shaun on 2026-10-27.
    eas: { projectId: 'db151b22-b7bd-4259-9a69-a4e2767741f3' },
  },
});
