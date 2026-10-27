import { Platform } from 'react-native';

/**
 * Where the app's server is, and the app's fixed names.
 *
 * The apex domain redirects every request to www, so the app calls www directly. EXPO_PUBLIC_SITE_URL
 * points it somewhere else (`next dev` on the dev database, or staging for the e2e build); Expo
 * inlines it when bundling.
 */
const CONFIGURED = process.env.EXPO_PUBLIC_SITE_URL || 'https://www.receiptwise.io';

/**
 * A local server, in the web preview, is called on the page's own host. For a phone, the server is
 * the Mac's network address (http://192.168.0.8:3418: on the phone, localhost is the phone); a
 * browser on the Mac at localhost:8081 calling that is another site, and refuses its session
 * cookie as third-party, so signing in there did nothing.
 */
function forThisPage(url: string): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return url;
  const parsed = new URL(url);
  const local = parsed.protocol === 'http:' && /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(parsed.hostname);
  if (!local) return url;
  parsed.hostname = window.location.hostname;
  return parsed.origin;
}

export const SITE_URL = forThisPage(CONFIGURED);
export const APP_NAME = 'ReceiptWise';
export const SUPPORT_EMAIL = 'support@receiptwise.io';

/**
 * Password sign-in for test accounts (@receiptwise.test), only where the server allows it: locally
 * and on staging. The web preview and the e2e build use it; store builds never set it.
 */
export const DEV_LOGIN = process.env.EXPO_PUBLIC_DEV_LOGIN === '1';
