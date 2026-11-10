import { createHmac, timingSafeEqual } from 'crypto';
import { getAppUrl } from '../app-url';

/*
 * Receipt images live in the private store. In the database a private image is
 * `private:<pathname>`; anything else is an older image still at a public Blob URL.
 *
 * receipts.image_url is a custom column (lib/db/schema.ts) that turns `private:<pathname>` into a
 * signed link to /receipt-images/<pathname> on every read, and a signed link back into
 * `private:<pathname>` on every write. So every route, the app and the extension get a link they can
 * show as they are, and no route can forget to sign one.
 *
 * A link is good for 6 to 12 hours and stays the same within each 6-hour window, so browsers and the
 * app can cache it. The route checks only the signature: no session, and no database.
 *
 * Relative imports only: drizzle-kit loads lib/db/schema.ts, and this, without the "@/" alias.
 */

export const PRIVATE_IMAGE_PREFIX = 'private:';
export const RECEIPT_IMAGE_ROUTE = '/receipt-images/';
const WINDOW_SECONDS = 6 * 60 * 60;

function signingKey(): Buffer | null {
  const secret = process.env.BETTER_AUTH_SECRET;
  return secret ? createHmac('sha256', secret).update('receipt-image-v1').digest() : null;
}

function signature(key: Buffer, pathname: string, expires: number): string {
  return createHmac('sha256', key).update(`${pathname}\n${expires}`).digest('base64url');
}

/** A link to a private image, good for at least `ttlSeconds` (default: one 6-hour window). */
export function signedReceiptImageUrl(pathname: string, { now = Date.now(), ttlSeconds = WINDOW_SECONDS } = {}): string | null {
  const key = signingKey();
  if (!key) return null;
  const expires = Math.ceil((Math.floor(now / 1000) + ttlSeconds) / WINDOW_SECONDS) * WINDOW_SECONDS;
  const path = pathname.split('/').map(encodeURIComponent).join('/');
  return `${getAppUrl()}${RECEIPT_IMAGE_ROUTE}${path}?e=${expires}&s=${signature(key, pathname, expires)}`;
}

/** Whether a signature is ours for this pathname and expiry; expiry itself isn't checked here. */
export function isValidReceiptImageSignature(pathname: string, expires: number, provided: string): boolean {
  const key = signingKey();
  if (!key || !Number.isFinite(expires)) return false;
  const expected = Buffer.from(signature(key, pathname, expires));
  const given = Buffer.from(provided);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The pathname in one of our signed links, if it really is one (signature checked, not expiry). */
function signedLinkPathname(value: string): string | null {
  try {
    const url = new URL(value);
    if (!url.pathname.startsWith(RECEIPT_IMAGE_ROUTE)) return null;
    const pathname = url.pathname.slice(RECEIPT_IMAGE_ROUTE.length).split('/').map(decodeURIComponent).join('/');
    const expires = Number(url.searchParams.get('e'));
    const provided = url.searchParams.get('s') ?? '';
    return isValidReceiptImageSignature(pathname, expires, provided) ? pathname : null;
  } catch {
    return null;
  }
}

/** The private store pathname behind a stored value or a signed link, or null for a public image. */
export function privateImagePathname(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith(PRIVATE_IMAGE_PREFIX)) return value.slice(PRIVATE_IMAGE_PREFIX.length);
  return signedLinkPathname(value);
}

/** Column read: what clients are given. Without the signing secret (a script), the stored value. */
export function receiptImageForClient(stored: string): string {
  if (!stored.startsWith(PRIVATE_IMAGE_PREFIX)) return stored;
  return signedReceiptImageUrl(stored.slice(PRIVATE_IMAGE_PREFIX.length)) ?? stored;
}

/** Column write: a signed link of ours goes back to `private:<pathname>`; anything else as it is. */
export function receiptImageForStorage(value: string): string {
  const pathname = value.startsWith(PRIVATE_IMAGE_PREFIX) ? null : signedLinkPathname(value);
  return pathname ? `${PRIVATE_IMAGE_PREFIX}${pathname}` : value;
}

/** For a data export: the same image, with a link that lasts 30 days instead of hours. */
export function longLivedReceiptImageUrl(value: string): string {
  const pathname = privateImagePathname(value);
  return pathname ? signedReceiptImageUrl(pathname, { ttlSeconds: 30 * 24 * 60 * 60 }) ?? value : value;
}
