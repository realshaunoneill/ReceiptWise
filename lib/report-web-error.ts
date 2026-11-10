/**
 * Sends a website crash to POST /api/app-errors, the endpoint the app's error screen uses, so it
 * reaches the same logs and alerts. Signed-out visitors get a 401 and nothing is kept: the route
 * is signed in only. Best effort, once per error, and never throws.
 */
const sent = new WeakSet<Error>();

export function reportWebError(error: Error & { digest?: string }) {
  if (typeof window === 'undefined' || sent.has(error)) return;
  sent.add(error);
  const message = error.digest ? `${error.message} (digest ${error.digest})` : error.message;
  void fetch('/api/app-errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-client': 'web' },
    body: JSON.stringify({
      message: (message || 'Unknown error').slice(0, 1000),
      stack: error.stack?.slice(0, 6000),
      path: window.location.pathname.slice(0, 300),
      platform: 'web',
    }),
    keepalive: true,
  }).catch(() => {});
}
