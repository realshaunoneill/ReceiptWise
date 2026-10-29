/**
 * Where a link into the app goes: www.receiptwise.io pages the app claims (lib/app-links.ts) and
 * receiptwise:// links, mapped to the app's own routes. Pure, so it's tested
 * (src/links.test.ts); app/+native-intent.tsx applies it. Anything it doesn't know is left as it
 * is (null), and the router opens it as a path, or shows its not-found screen.
 */

const HOSTS = new Set(['www.receiptwise.io', 'receiptwise.io']);
const INVITE = /^\/invite\/([a-f0-9]{64})\/?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A file another app opened in ReceiptWise ("Open in", Mail's or Files' share): iOS hands over a
 * file:// URL to a copy in the app's Inbox, Android a content:// one. It goes to capture, which
 * offers to add it as a receipt or a bill.
 */
export function routeForFile(link: string): string | null {
  if (!/^(file|content):\/\//i.test(link)) return null;
  return `/capture?file=${encodeURIComponent(link)}`;
}

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
  } else if (url.protocol === 'receiptwise:' || url.protocol === 'receiptwise-dev:') {
    // receiptwise-dev:// is the development build's own scheme (app.config.ts).
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
  if (path === '/subscriptions') {
    // A notification about one bill (lib/push/messages.ts) opens that bill.
    const selected = url.searchParams.get('selected');
    return selected && UUID.test(selected) ? `/bills/${selected}` : '/bills';
  }
  if (path === '/sharing') return '/settings/households';
  if (path === '/settings') return '/settings';
  return null;
}
