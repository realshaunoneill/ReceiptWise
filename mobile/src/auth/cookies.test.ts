import { describe, expect, it } from 'vitest';

import { cookieHeader, mergeSetCookie, parseJar } from './cookies';

const NOW = Date.parse('2026-10-19T12:00:00Z');

// The shape better-auth sends in production: the secure-prefixed session token
// and its five-minute session_data cache, joined into one header by Headers.get().
const SIGN_IN = [
  '__Secure-better-auth.session_token=tok123.c2lnbmF0dXJl%3D; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax',
  '__Secure-better-auth.session_data=eyJzZXNzaW9uIjp7fX0; Max-Age=300; Path=/; HttpOnly; Secure; SameSite=Lax',
].join(', ');

describe('mergeSetCookie', () => {
  it('keeps the session token, with its expiry from Max-Age', () => {
    const jar = mergeSetCookie({}, SIGN_IN, NOW);

    expect(jar).toEqual({
      '__Secure-better-auth.session_token': {
        value: 'tok123.c2lnbmF0dXJl%3D',
        expires: '2026-10-26T12:00:00.000Z',
      },
    });
  });

  it('drops the session_data cache, which can outgrow SecureStore', () => {
    const jar = mergeSetCookie({}, SIGN_IN, NOW);

    expect(Object.keys(jar).some((k) => k.includes('session_data'))).toBe(false);
  });

  it('removes the token when sign-out sends it already expired', () => {
    const signedIn = mergeSetCookie({}, SIGN_IN, NOW);
    const signedOut = mergeSetCookie(signedIn, '__Secure-better-auth.session_token=; Max-Age=0; Path=/', NOW);

    expect(signedOut).toEqual({});
  });

  it('does not split on the comma inside an Expires date', () => {
    const header = 'better-auth.session_token=abc; Expires=Mon, 26 Oct 2026 12:00:00 GMT; Path=/, other=1';

    expect(mergeSetCookie({}, header, NOW)['better-auth.session_token']).toEqual({
      value: 'abc',
      expires: '2026-10-26T12:00:00.000Z',
    });
  });

  it('prefers Max-Age over Expires', () => {
    const header = 'better-auth.session_token=abc; Expires=Mon, 26 Oct 2026 12:00:00 GMT; Max-Age=60';

    expect(mergeSetCookie({}, header, NOW)['better-auth.session_token'].expires).toBe('2026-10-19T12:01:00.000Z');
  });

  it('replaces an older token with a refreshed one', () => {
    const first = mergeSetCookie({}, 'better-auth.session_token=old; Max-Age=60', NOW);
    const second = mergeSetCookie(first, 'better-auth.session_token=new; Max-Age=60', NOW);

    expect(second['better-auth.session_token'].value).toBe('new');
  });

  it('ignores a malformed header', () => {
    expect(mergeSetCookie({}, 'garbage', NOW)).toEqual({});
    expect(mergeSetCookie({}, '', NOW)).toEqual({});
  });
});

describe('cookieHeader', () => {
  it('builds the Cookie header the server reads the session from', () => {
    const jar = mergeSetCookie({}, SIGN_IN, NOW);

    expect(cookieHeader(jar, NOW)).toBe('__Secure-better-auth.session_token=tok123.c2lnbmF0dXJl%3D');
  });

  it('leaves out a token that has expired since it was stored', () => {
    const jar = mergeSetCookie({}, 'better-auth.session_token=abc; Max-Age=60', NOW);

    expect(cookieHeader(jar, NOW + 61_000)).toBe('');
  });

  it('is empty when signed out', () => {
    expect(cookieHeader({}, NOW)).toBe('');
  });
});

describe('parseJar', () => {
  it('reads what was stored', () => {
    const jar = mergeSetCookie({}, SIGN_IN, NOW);

    expect(parseJar(JSON.stringify(jar))).toEqual(jar);
  });

  it.each([null, '', '{not json', '[]', '"string"'])('treats %j as signed out', (stored) => {
    expect(parseJar(stored)).toEqual({});
  });
});
