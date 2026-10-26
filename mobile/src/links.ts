/**
 * Where a link into the app goes: www.receiptwise.io pages the app claims (lib/app-links.ts) and
 * receiptwise:// links, mapped to the app's own routes. Pure, so it's tested
 * (src/links.test.ts); app/+native-intent.tsx applies it. Anything it doesn't know is left as it
 * is (null), and the router opens it as a path, or shows its not-found screen.
 */

const HOSTS = new Set(['www.receiptwise.io', 'receiptwise.io']);
const INVITE = /^\/invite\/([a-f0-9]{64})\/?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The route for a link, or null to leave it alone. */
export function routeForLink(link: string): string | null {
  let url: URL;
  try {
    // A bare path (what the router hands over for an app link) is read as one of the website's.
    url = new URL(link, 'https://www.receiptwise.io');
  } catch {
    return null;
  }

  let path: string;
  if (url.protocol === 'https:' || url.protocol === 'http:') {
    if (!HOSTS.has(url.hostname)) return null;
    path = url.pathname;
  } else if (url.protocol === 'receiptwise:') {
    // receiptwise://receipts/1 puts "receipts" in the host; receiptwise:///receipts/1 doesn't.
    path = `/${url.hostname}${url.pathname}`.replace(/\/+/g, '/');
  } else {
    return null;
  }
  path = path.length > 1 ? path.replace(/\/$/, '') : path;

  const invite = INVITE.exec(path);
  if (invite) return `/invite/${invite[1]}`;
  if (path === '/receipts') {
    const selected = url.searchParams.get('selected');
    return selected && UUID.test(selected) ? `/receipts/${selected}` : '/receipts';
  }
  if (path === '/plan') return '/plan';
  if (path === '/dashboard') return '/';
  if (path === '/subscriptions') return '/bills';
  return null;
}
