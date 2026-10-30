/**
 * How someone found ReceiptWise, saved once on a new account (users.signup_source and
 * signup_campaign). It travels as ?src= and ?cmp= from the landing page's sign-up links, through
 * Google's sign-in callback, to /redirect, which records it. Never a cookie or browser storage,
 * which would need consent (lib/analytics/consent.ts): only the links carry it.
 */

const MAX = 64;

/** A source or campaign as stored: lowercase, no "www.", only [a-z0-9._-], at most 64 characters. */
export function cleanAttribution(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase().replace(/^www\./, '');
  if (!value || value.length > MAX || !/^[a-z0-9._-]+$/.test(value)) return null;
  return value;
}

/**
 * The source and campaign of a visit to the landing page: utm_source if the link has one (LLMs tag
 * theirs, e.g. utm_source=chatgpt.com), otherwise the site the visitor came from, unless that's
 * this one.
 */
export function visitAttribution(search: string, referrer: string, ownHost: string): { src: string | null; cmp: string | null } {
  const params = new URLSearchParams(search);
  let src = cleanAttribution(params.get('utm_source') ?? params.get('src'));
  if (!src && referrer) {
    try {
      const host = new URL(referrer).hostname.replace(/^www\./, '');
      if (host && host !== ownHost.replace(/^www\./, '')) src = cleanAttribution(host);
    } catch {
      // Not a URL: no source.
    }
  }
  return { src, cmp: cleanAttribution(params.get('utm_campaign') ?? params.get('cmp')) };
}

/** "?src=…&cmp=…" for a link, or "" when there's nothing to carry. */
export function attributionQuery({ src, cmp }: { src: string | null; cmp: string | null }): string {
  const params = new URLSearchParams();
  if (src) params.set('src', src);
  if (cmp) params.set('cmp', cmp);
  const query = params.toString();
  return query ? `?${query}` : '';
}
