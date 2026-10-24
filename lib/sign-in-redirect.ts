/**
 * Where sign-in sends people. Plain functions with no imports: the sign-in pages are server
 * components and read ?redirect_url there, and the panel they render is a client component.
 */

/** Where a first-time account goes: /redirect picks the upgrade page or a pending invitation. */
export const NEW_USER_URL = '/redirect';

/** A path on this site to return to after signing in, from ?redirect_url. Never another origin. */
export function safeNext(value: string | string[] | undefined, fallback = NEW_USER_URL): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  // The sign-in pages themselves would loop.
  if (/^\/sign-(in|up)(\/|\?|$)/.test(raw)) return fallback;
  return raw;
}
