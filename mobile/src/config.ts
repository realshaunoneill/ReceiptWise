/**
 * Where the app's server is, and the app's fixed names.
 *
 * The apex domain redirects every request to www, so the app calls www directly. EXPO_PUBLIC_SITE_URL
 * points it somewhere else (`next dev` on the dev database, or staging for the e2e build); Expo
 * inlines it when bundling.
 */
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || 'https://www.receiptwise.io';
export const APP_NAME = 'ReceiptWise';
export const SUPPORT_EMAIL = 'support@receiptwise.io';

/**
 * Password sign-in for test accounts (@receiptwise.test), only where the server allows it: locally
 * and on staging. The web preview and the e2e build use it; store builds never set it.
 */
export const DEV_LOGIN = process.env.EXPO_PUBLIC_DEV_LOGIN === '1';
