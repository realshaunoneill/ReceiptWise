import { shiftDates } from './shift';

/**
 * The demo's API: while /demo is open, the browser's fetch answers the app's GETs to /api from
 * the recorded fixture (dates moved on to this month), and refuses every write with a message
 * the page shows. Nothing reaches the server, so there's no account, session or data behind the
 * demo to look into or change. Requests that aren't to /api go through untouched.
 */

export const DEMO_WRITE_REFUSED = 'This is a demo, so nothing is saved. Start the free trial to make it yours.';

/** "/api/plan?offset=0": the path and its parameters in order, without ?today (it varies by day). */
export function demoKey(url: URL): string {
  const params = [...url.searchParams.entries()].filter(([key]) => key !== 'today').sort(([a], [b]) => a.localeCompare(b));
  return params.length ? `${url.pathname}?${new URLSearchParams(params).toString()}` : url.pathname;
}

/** Answer from the recorded responses: the exact request, else the same path recorded without filters. */
export function demoAnswer(responses: Record<string, unknown>, url: URL, method: string): { status: number; body: unknown } {
  if (method !== 'GET') return { status: 403, body: { error: DEMO_WRITE_REFUSED } };
  const key = demoKey(url);
  if (key in responses) return { status: 200, body: responses[key] };
  // Another page of receipts, a filter, a sort: the first recorded answer for the path. Not for the
  // plan, where another offset is another month, so a month outside the demo says so.
  if (url.pathname !== '/api/plan') {
    const fallback = Object.keys(responses).find((recorded) => recorded.split('?')[0] === url.pathname);
    if (fallback) return { status: 200, body: responses[fallback] };
  }
  return { status: 404, body: { error: 'That isn\'t in the demo. Start the free trial to see your own.' } };
}

/** Put the demo's fetch in place. Returns the function that puts the real one back. */
export function installDemoFetch(fixture: Record<string, unknown>, months: number): () => void {
  const real = window.fetch;
  const responses = Object.fromEntries(Object.entries(fixture).map(([key, body]) => [demoKey(new URL(key, window.location.origin)), shiftDates(body, months)]));
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return real(input, init);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const { status, body } = demoAnswer(responses, url, method);
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  return () => {
    window.fetch = real;
  };
}
