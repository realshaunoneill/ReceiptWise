import { describe, expect, it } from 'vitest';
import { withExpoOrigin } from './expo-origin';

describe('withExpoOrigin', () => {
  it("copies the app's expo-origin into Origin, keeping the method, headers and body", async () => {
    const request = new Request('https://www.receiptwise.io/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'expo-origin': 'receiptwise://', cookie: '__Secure-better-auth.session_token=abc', 'content-type': 'application/json' },
      body: '{"provider":"google"}',
    });

    const result = await withExpoOrigin(request);

    expect(result.headers.get('origin')).toBe('receiptwise://');
    expect(result.headers.get('cookie')).toBe('__Secure-better-auth.session_token=abc');
    expect(result.method).toBe('POST');
    expect(result.url).toBe('https://www.receiptwise.io/api/auth/sign-in/social');
    expect(await result.text()).toBe('{"provider":"google"}');
  });

  it("leaves a browser's own Origin alone", async () => {
    const request = new Request('https://www.receiptwise.io/api/auth/get-session', {
      headers: { origin: 'https://www.receiptwise.io', 'expo-origin': 'receiptwise://' },
    });
    expect(await withExpoOrigin(request)).toBe(request);
  });

  it('passes through a request with neither header', async () => {
    const request = new Request('https://www.receiptwise.io/api/auth/get-session');
    expect(await withExpoOrigin(request)).toBe(request);
  });
});
