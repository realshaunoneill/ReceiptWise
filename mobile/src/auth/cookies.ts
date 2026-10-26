/**
 * The session cookie, kept by hand.
 *
 * React Native has no cookie jar the app controls, so after sign-in the session
 * arrives as a raw Set-Cookie header (the better-auth Expo plugin on the server
 * appends it to the deep link) and is sent back as a Cookie header on every
 * authenticated request. This file is the pure part of that: parsing, expiry and
 * building the header. Storage lives in auth.ts.
 */

export interface StoredCookie {
  value: string;
  /** ISO timestamp, or null for a cookie with no expiry. */
  expires: string | null;
}

export type CookieJar = Record<string, StoredCookie>;

/**
 * Only the session token is kept. better-auth also sets `session_data`, a
 * five-minute cache of the session that can run to a kilobyte; the server falls
 * back to the database without it, and SecureStore can reject values over
 * 2 KB on some Android versions.
 */
const isSessionToken = (name: string) => name.endsWith('session_token');

/**
 * Splits a header that may hold several cookies joined by ", ". A plain split
 * would break `Expires=Wed, 21 Oct 2026 …`, so only split where the next thing
 * is a `name=` pair.
 */
const splitCookies = (header: string): string[] => header
  .split(/,(?=\s*[^;,=\s]+=)/)
  .map((part) => part.trim())
  .filter(Boolean);

/** Applies a Set-Cookie header to the jar, returning a new jar. */
export function mergeSetCookie(jar: CookieJar, header: string, now: number = Date.now()): CookieJar {
  const next: CookieJar = { ...jar };

  for (const raw of splitCookies(header)) {
    const [pair, ...attributes] = raw.split(';').map((s) => s.trim());
    const eq = pair.indexOf('=');

    if (eq <= 0) {
      continue;
    }

    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);

    if (!isSessionToken(name)) {
      continue;
    }

    let expires: number | null = null;

    for (const attribute of attributes) {
      const [key, ...rest] = attribute.split('=');
      const attrValue = rest.join('=');

      // Max-Age wins over Expires, as it does in a browser.
      if (key.toLowerCase() === 'max-age') {
        expires = now + Number(attrValue) * 1000;
        break;
      }

      if (key.toLowerCase() === 'expires') {
        const parsed = Date.parse(attrValue);

        if (!Number.isNaN(parsed)) {
          expires = parsed;
        }
      }
    }

    // A sign-out clears the cookie by sending it already expired.
    if (expires !== null && expires <= now) {
      delete next[name];
      continue;
    }

    next[name] = { value, expires: expires === null ? null : new Date(expires).toISOString() };
  }

  return next;
}

/** The Cookie header for a request, leaving out anything that has expired. */
export function cookieHeader(jar: CookieJar, now: number = Date.now()): string {
  return Object.entries(jar)
    .filter(([, c]) => c.expires === null || Date.parse(c.expires) > now)
    .map(([name, c]) => `${name}=${c.value}`)
    .join('; ');
}

/** Reads a stored jar, treating anything unreadable as signed out. */
export function parseJar(stored: string | null): CookieJar {
  if (!stored) {
    return {};
  }

  try {
    const parsed = JSON.parse(stored);

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as CookieJar : {};
  } catch {
    return {};
  }
}
