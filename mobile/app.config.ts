import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * The app's native config. One bundle id for every build profile (development, preview,
 * production): the server trusts it for Sign in with Apple, app links and, later, push and the
 * stores' purchases, so separate variants would multiply all of those.
 *
 * Icons and the splash image are drawn from brand/mark.svg by scripts/brand-assets.py (approved
 * 2026-10-27); an icon change is native, so it needs a new build, not an update.
 */
/**
 * The development build is its own app, "ReceiptWise Dev", so it fits beside the TestFlight or store
 * app on one phone (a phone holds one app per bundle id). eas.json's development profile sets
 * APP_VARIANT, and so must `expo start` for it (`APP_VARIANT=development npx expo start`), so the
 * scheme the running JS uses matches the app's. Not an npm script: package.json scripts are part of
 * the native fingerprint, and one would have cut the store builds off from their updates. The server
 * trusts the dev identity everywhere but production (lib/auth.ts).
 */
const DEV = process.env.APP_VARIANT === 'development';

const CAMERA_PERMISSION = "ReceiptWise uses the camera to scan receipts and bills. They're uploaded to your account so they can be read.";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: DEV ? 'ReceiptWise Dev' : 'ReceiptWise',
  slug: 'receiptwise',
  owner: 'realshaunoneill',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: DEV ? 'receiptwise-dev' : 'receiptwise',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  runtimeVersion: { policy: 'fingerprint' },
  // EAS Update: JS-only changes reach installed builds with `eas update --channel <profile's channel>`.
  // The fingerprint runtime means an update only goes to builds with the same native code.
  updates: { url: 'https://u.expo.dev/db151b22-b7bd-4259-9a69-a4e2767741f3' },
  ios: {
    bundleIdentifier: DEV ? 'io.receiptwise.app.dev' : 'io.receiptwise.app',
    // iOS 18's light, dark and tinted home-screen icons.
    icon: { light: './assets/icon.png', dark: './assets/icon-dark.png', tinted: './assets/icon-tinted.png' },
    supportsTablet: false,
    usesAppleSignIn: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // "Open in ReceiptWise" for a PDF or a photo, from Mail, Files or Safari (phase 5). iOS copies
      // it into the app's Inbox and opens the app with a file:// link (src/links.ts routeForFile).
      CFBundleDocumentTypes: [
        { CFBundleTypeName: 'PDF document', CFBundleTypeRole: 'Viewer', LSHandlerRank: 'Alternate', LSItemContentTypes: ['com.adobe.pdf'] },
        { CFBundleTypeName: 'Image', CFBundleTypeRole: 'Viewer', LSHandlerRank: 'Alternate', LSItemContentTypes: ['public.jpeg', 'public.png', 'public.heic'] },
      ],
      LSSupportsOpeningDocumentsInPlace: false,
    },
  },
  android: {
    package: DEV ? 'io.receiptwise.app.dev' : 'io.receiptwise.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/adaptive-icon-monochrome.png',
      backgroundColor: '#F2EFEA',
    },
    // Receipts and the session stay off Google's backups.
    allowBackup: false,
    predictiveBackGestureEnabled: false,
    // "Open with ReceiptWise" for a PDF or a photo (phase 5): a content:// link, as on iOS.
    intentFilters: [
      {
        action: 'VIEW',
        category: ['DEFAULT', 'BROWSABLE'],
        data: [{ scheme: 'content', mimeType: 'application/pdf' }, { scheme: 'content', mimeType: 'image/*' }],
      },
    ],
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
    // Push (phase 4): the Android small icon and accent. On iOS this adds the push entitlement, so
    // the next iOS build needs the App ID's Push Notifications capability (an Apple step on cevo).
    ['expo-notifications', { icon: './assets/notification-icon.png', color: '#04756F' }],
    // App lock (phase 5).
    ['expo-local-authentication', { faceIDPermission: 'ReceiptWise uses Face ID to unlock the app when App lock is on.' }],
    // The app icon's quick actions (phase 5).
    'expo-quick-actions',
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
