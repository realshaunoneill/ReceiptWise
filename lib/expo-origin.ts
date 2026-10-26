/**
 * The app can't send an Origin header, so it sends `expo-origin`, and Better Auth's origin check
 * needs that copied into Origin. The expo() plugin does the copy with `new Request(request, …)`,
 * which Node 24 refused for Next's request object in Behind The Badge ("Cannot read private member
 * #state"), so every auth call from that app was a 500 in production (2026-10-24). The auth route
 * (app/api/auth/[...all]/route.ts) runs this instead, building a fresh request from the URL, and
 * lib/auth.ts turns the plugin's own copy off. Browsers always send Origin, so the website is
 * untouched.
 */
export async function withExpoOrigin(request: Request): Promise<Request> {
  const expoOrigin = request.headers.get('expo-origin');
  if (!expoOrigin || request.headers.get('origin')) return request;

  const headers = new Headers(request.headers);
  headers.set('origin', expoOrigin);
  return new Request(request.url, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
  });
}
