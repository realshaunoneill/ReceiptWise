/**
 * Sign-in, talking to the website's Better Auth directly: Google through the browser, Apple
 * natively on iOS (the App Store requires it beside Google). Ported from Behind The Badge's app.
 *
 * The flow is the one @better-auth/expo's client implements, without the better-auth package: that
 * pulls in its server and optional database peers, which `npm ci` on EAS then refuses. The server
 * half is the expo() plugin in lib/auth.ts, with lib/expo-origin.ts in the auth route.
 *
 * 1. POST /sign-in/social with the app's deep link as the callback. The plugin accepts the
 *    `expo-origin` header in place of a browser's Origin.
 * 2. Open Google in an auth session, through the plugin's authorization proxy, which plants the
 *    OAuth state cookie in that browser.
 * 3. After Google, Better Auth redirects to the deep link, and the plugin appends the session's
 *    Set-Cookie header as `?cookie=`.
 * 4. Keep the session token in SecureStore and send it as a Cookie header (src/api/client.ts).
 *
 * Apple skips the browser: the system sheet returns an identity token, which Better Auth checks
 * against Apple's keys and the bundle id, and the session cookie comes back on that response.
 *
 * The web preview (only for checking screens in a browser) can't set a Cookie header, so there the
 * browser keeps the cookie itself and requests send credentials.
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { CONSENT_COOKIE, getConsent } from '../analytics';
import { SITE_URL } from '../config';
import { cookieHeader, mergeSetCookie, parseJar, type CookieJar } from './cookies';

const AUTH_URL = `${SITE_URL}/api/auth`;
const JAR_KEY = 'receiptwise_auth_cookies';
const IS_WEB = Platform.OS === 'web';

/** Readable after the first unlock, so a background upload can still send the session. */
const STORE_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

/**
 * Expo Go opens deep links as exp://, which the server trusts only under `next dev`, so sign-in
 * can't finish there. It needs a development or store build, with the app's receiptwise:// scheme.
 */
export const signInUnavailable = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

async function loadJar(): Promise<CookieJar> {
  if (IS_WEB) return {};
  try {
    return parseJar(await SecureStore.getItemAsync(JAR_KEY, STORE_OPTIONS));
  } catch {
    return {};
  }
}

async function saveJar(jar: CookieJar): Promise<void> {
  if (IS_WEB) return;
  if (Object.keys(jar).length === 0) await SecureStore.deleteItemAsync(JAR_KEY, STORE_OPTIONS);
  else await SecureStore.setItemAsync(JAR_KEY, JSON.stringify(jar), STORE_OPTIONS);
}

/** How requests carry the session: a Cookie header the app sets, or the browser's own on the web. */
export const credentials: RequestCredentials = IS_WEB ? 'include' : 'omit';

/**
 * Headers that identify this app and carry the session, for any call to the server, with the
 * analytics choice as the website's consent cookie once one is made (src/analytics.ts).
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const consent = getConsent();
  const cookie = [cookieHeader(await loadJar()), consent && !IS_WEB ? `${CONSENT_COOKIE}=${consent}` : ''].filter(Boolean).join('; ');
  return {
    'expo-origin': Linking.createURL(''),
    ...(cookie ? { cookie } : {}),
  };
}

/** Whether a session is stored at all (the web preview can't tell, so it asks the server). */
export async function hasStoredSession(): Promise<boolean> {
  return IS_WEB || Boolean(cookieHeader(await loadJar()));
}

/** Picks up a refreshed or cleared session cookie, where the platform exposes Set-Cookie. */
export async function absorbSetCookie(res: Response): Promise<void> {
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) await saveJar(mergeSetCookie(await loadJar(), setCookie));
}

/** Resolves true once signed in; false if the person backed out. */
export async function signInWithGoogle(): Promise<boolean> {
  const callbackURL = Linking.createURL('/');
  const res = await fetch(`${AUTH_URL}/sign-in/social`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', 'expo-origin': Linking.createURL('') },
    body: JSON.stringify({ provider: 'google', callbackURL }),
  });
  if (!res.ok) throw new Error(`Couldn't start signing in (${res.status})`);
  const { url } = (await res.json()) as { url?: string };
  if (!url) throw new Error("Couldn't start signing in");

  const proxy = `${AUTH_URL}/expo-authorization-proxy?authorizationURL=${encodeURIComponent(url)}`;
  const result = await WebBrowser.openAuthSessionAsync(proxy, callbackURL);
  if (result.type !== 'success') return false;

  const cookie = Linking.parse(result.url).queryParams?.cookie;
  if (typeof cookie !== 'string' || !cookie) throw new Error("Signing in didn't return a session");
  await saveJar(mergeSetCookie(await loadJar(), cookie));
  return true;
}

/** Sign in with Apple is an iOS feature: the button only shows where the sheet can open. */
export async function appleSignInAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && !signInUnavailable && AppleAuthentication.isAvailableAsync();
}

/** Resolves true once signed in; false if the person cancelled the sheet. */
export async function signInWithApple(): Promise<boolean> {
  // Bound into the identity token by Apple and checked by Better Auth, so a token lifted from
  // elsewhere can't be replayed here.
  const nonce = Crypto.randomUUID();
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce,
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw err;
  }
  if (!credential.identityToken) throw new Error("Apple didn't return a sign-in token");

  const res = await fetch(`${AUTH_URL}/sign-in/social`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', 'expo-origin': Linking.createURL('') },
    body: JSON.stringify({ provider: 'apple', idToken: { token: credential.identityToken, nonce } }),
  });
  if (!res.ok) throw new Error(`Couldn't sign in with Apple (${res.status})`);
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error("Signing in didn't return a session");
  await saveJar(mergeSetCookie(await loadJar(), setCookie));

  // Apple shares the name once, on the first sign-in, and never in the token, so a new account
  // starts nameless and is named from the sheet's answer.
  const { user } = (await res.json()) as { user?: { name?: string } };
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
  if (user && !user.name && name) {
    await fetch(`${AUTH_URL}/update-user`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ name }),
    }).catch(() => undefined);
  }
  return true;
}

/**
 * Password sign-in, for test accounts (@receiptwise.test) where the server allows it: locally and
 * on staging (lib/dev-login.ts). Used by the web preview and the e2e build only.
 */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  const res = await fetch(`${AUTH_URL}/sign-in/email`, {
    method: 'POST',
    credentials,
    headers: { 'Content-Type': 'application/json', 'expo-origin': Linking.createURL('') },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || `Couldn't sign in (${res.status})`);
  }
  await absorbSetCookie(res);
}

/** The signed-in person, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!(await hasStoredSession())) return null;
  const res = await fetch(`${AUTH_URL}/get-session`, { credentials, headers: await authHeaders() });
  if (!res.ok) return null;
  await absorbSetCookie(res);
  const body = (await res.json()) as { user?: SessionUser } | null;
  return body?.user ?? null;
}

export async function signOut(): Promise<void> {
  try {
    await fetch(`${AUTH_URL}/sign-out`, {
      method: 'POST',
      credentials,
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: '{}',
    });
  } finally {
    // Signed out here whatever the server said.
    await saveJar({});
  }
}

// ----- Sign-in methods: more than one way into the same account -----

/** A way of signing in to this account: 'google', 'apple', or 'credential' (a test account's password). */
export type LinkedAccount = { id: string; providerId: string; accountId: string; createdAt: string };

async function authCall<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${AUTH_URL}${path}`, {
    method: init.method ?? 'GET',
    credentials,
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  await absorbSetCookie(res);
  const body = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok) throw new Error(body?.message || `That didn't work (${res.status})`);
  return body as T;
}

export function listLinkedAccounts(): Promise<LinkedAccount[]> {
  return authCall<LinkedAccount[]>('/list-accounts');
}

/**
 * Add Google to the signed-in account: the same browser flow as signing in, through
 * /link-social. Better Auth keeps who is linking in the OAuth state, so the browser needs no
 * session; afterwards it returns to the deep link, with ?error= if Google's account couldn't be
 * added (already another account's, say). Resolves false if the person backed out.
 */
export async function linkGoogle(): Promise<boolean> {
  const callbackURL = Linking.createURL('/settings/sign-in-methods');
  const { url } = await authCall<{ url?: string }>('/link-social', {
    method: 'POST',
    body: { provider: 'google', callbackURL, errorCallbackURL: callbackURL, disableRedirect: true },
  });
  if (!url) throw new Error("Couldn't start adding Google");
  const proxy = `${AUTH_URL}/expo-authorization-proxy?authorizationURL=${encodeURIComponent(url)}`;
  const result = await WebBrowser.openAuthSessionAsync(proxy, callbackURL);
  if (result.type !== 'success') return false;
  const error = Linking.parse(result.url).queryParams?.error;
  if (typeof error === 'string' && error) {
    throw new Error(/already_linked|linked_to_different_user/i.test(error)
      ? 'That Google account is already used by another ReceiptWise account.'
      : "Google couldn't be added. Try again.");
  }
  return true;
}

/** Add Sign in with Apple to the signed-in account (iOS): the system sheet's token, checked by the server. */
export async function linkApple(): Promise<boolean> {
  const nonce = Crypto.randomUUID();
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL], nonce });
  } catch (err) {
    if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw err;
  }
  if (!credential.identityToken) throw new Error("Apple didn't return a sign-in token");
  await authCall('/link-social', { method: 'POST', body: { provider: 'apple', idToken: { token: credential.identityToken, nonce } } });
  return true;
}

/** Remove a way of signing in. The server refuses to remove the last one. */
export async function unlinkAccount(account: Pick<LinkedAccount, 'providerId' | 'accountId'>): Promise<void> {
  await authCall('/unlink-account', { method: 'POST', body: { providerId: account.providerId, accountId: account.accountId } });
}

/** Forget the session on this phone, without telling the server (after an account is discarded). */
export async function forgetSession(): Promise<void> {
  await saveJar({});
}
