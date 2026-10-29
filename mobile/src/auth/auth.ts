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
 * Each account signed in on the device keeps its own session (src/auth/accounts.ts: a household
 * sharing an iPad signs each person in), and a request carries the active account's unless it
 * names another, as an upload captured by someone else does. Signing in adds an account; it goes
 * on screen with setActiveAccount once the sign-in screen has nothing left to ask.
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
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { CONSENT_COOKIE, getConsent } from '../analytics';
import { SITE_URL } from '../config';
import { activeSlot, addAccount, getAccounts, newSlot, removeAccount, saveSessionJar, sessionJar, updateAccount } from './accounts';
import { cookieHeader, mergeSetCookie } from './cookies';

const AUTH_URL = `${SITE_URL}/api/auth`;
const IS_WEB = Platform.OS === 'web';

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

/** How requests carry the session: a Cookie header the app sets, or the browser's own on the web. */
export const credentials: RequestCredentials = IS_WEB ? 'include' : 'omit';

/**
 * Headers that identify this app and carry an account's session (the active one's unless `slot`
 * names another), for any call to the server, with the analytics choice as the website's consent
 * cookie once one is made (src/analytics.ts).
 */
export async function authHeaders(slot: string | null = activeSlot()): Promise<Record<string, string>> {
  const consent = getConsent();
  const cookie = [slot ? cookieHeader(sessionJar(slot)) : '', consent && !IS_WEB ? `${CONSENT_COOKIE}=${consent}` : ''].filter(Boolean).join('; ');
  return {
    'expo-origin': Linking.createURL(''),
    ...(cookie ? { cookie } : {}),
  };
}

/** Whether an account has a session stored at all (the web preview can't tell, so it asks the server). */
export function hasStoredSession(slot: string | null = activeSlot()): boolean {
  if (!slot) return false;
  return IS_WEB || Boolean(cookieHeader(sessionJar(slot)));
}

/** Picks up a refreshed or cleared session cookie, where the platform exposes Set-Cookie. */
export async function absorbSetCookie(res: Response, slot: string | null = activeSlot()): Promise<void> {
  const setCookie = res.headers.get('set-cookie');
  if (setCookie && slot) saveSessionJar(slot, mergeSetCookie(sessionJar(slot), setCookie));
}

/** Whose session a slot holds, or null if the server says it has ended. Throws if it couldn't ask. */
async function sessionUserFor(slot: string): Promise<SessionUser | null> {
  const res = await fetch(`${AUTH_URL}/get-session`, { credentials, headers: await authHeaders(slot) });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Couldn't check the session (${res.status})`);
  await absorbSetCookie(res, slot);
  const body = (await res.json()) as { user?: SessionUser } | null;
  return body?.user ?? null;
}

/**
 * A sign-in's session arrived (its Set-Cookie header; the web preview's browser keeps its own):
 * keep it in a slot of its own, ask the server whose it is, and add the account. Someone already
 * on the device signing in again stays in their own slot, and their old session there is ended.
 */
async function finishSignIn(setCookie: string | null): Promise<string> {
  const slot = newSlot();
  if (!IS_WEB) {
    if (!setCookie) throw new Error("Signing in didn't return a session");
    saveSessionJar(slot, mergeSetCookie({}, setCookie));
  }
  const user = await sessionUserFor(slot).catch(() => null);
  if (!user) {
    saveSessionJar(slot, {});
    throw new Error("Signing in didn't return a session");
  }
  const previous = IS_WEB ? undefined : getAccounts().accounts.find((account) => account.authUserId === user.id);
  const previousHeaders = previous ? await authHeaders(previous.slot) : null;
  const added = addAccount({ slot, authUserId: user.id, name: user.name, email: user.email, image: user.image ?? null });
  if (previousHeaders) {
    void fetch(`${AUTH_URL}/sign-out`, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', ...previousHeaders }, body: '{}' }).catch(() => undefined);
  }
  return added;
}

/** Resolves to the account's slot once signed in; false if the person backed out. */
export async function signInWithGoogle(): Promise<string | false> {
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
  return finishSignIn(cookie);
}

/** Sign in with Apple is an iOS feature: the button only shows where the sheet can open. */
export async function appleSignInAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' && !signInUnavailable && AppleAuthentication.isAvailableAsync();
}

/**
 * Resolves to the account's slot once signed in; false if the person cancelled the sheet. Apple
 * signs in the device's own Apple Account, so on a shared iPad the others sign in with Google.
 */
export async function signInWithApple(): Promise<string | false> {
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
  const slot = await finishSignIn(res.headers.get('set-cookie'));

  // Apple shares the name once, on the first sign-in, and never in the token, so a new account
  // starts nameless and is named from the sheet's answer.
  const { user } = (await res.json()) as { user?: { name?: string } };
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
  if (user && !user.name && name) {
    const named = await fetch(`${AUTH_URL}/update-user`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders(slot)) },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    if (named?.ok) updateAccount(slot, { name });
  }
  return slot;
}

/**
 * Password sign-in, for test accounts (@receiptwise.test) where the server allows it: locally and
 * on staging (lib/dev-login.ts). Used by the web preview and the e2e build only.
 */
export async function signInWithPassword(email: string, password: string): Promise<string> {
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
  return finishSignIn(res.headers.get('set-cookie'));
}

/**
 * The person on screen, or null if they're signed out (their session ended). Throws if the server
 * couldn't be asked. Their name, email and picture are kept with the account, for the switcher.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const slot = activeSlot();
  if (!slot || !hasStoredSession(slot)) return null;
  const user = await sessionUserFor(slot);
  if (user) updateAccount(slot, { authUserId: user.id, name: user.name, email: user.email, image: user.image ?? null });
  return user;
}

/**
 * Keep every other account's session alive: a session lasts 30 days from when it was last used,
 * and on a shared iPad someone may not open their account for longer than that. Asking whose it
 * is refreshes it, at most once a day (the server's updateAge). Returns the slots whose sessions
 * have ended, to forget.
 */
export async function refreshOtherSessions(): Promise<string[]> {
  if (IS_WEB) return [];
  const ended: string[] = [];
  for (const account of getAccounts().accounts) {
    if (account.slot === activeSlot()) continue;
    const user = await sessionUserFor(account.slot).catch(() => undefined);
    if (user === null) ended.push(account.slot);
    else if (user) updateAccount(account.slot, { name: user.name, email: user.email, image: user.image ?? null });
  }
  return ended;
}

/** Sign one account out here and on the server (the active one unless `slot` says). */
export async function signOut(slot: string | null = activeSlot()): Promise<void> {
  if (!slot) return;
  try {
    await fetch(`${AUTH_URL}/sign-out`, {
      method: 'POST',
      credentials,
      headers: { 'Content-Type': 'application/json', ...(await authHeaders(slot)) },
      body: '{}',
    });
  } finally {
    // Signed out here whatever the server said.
    removeAccount(slot);
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

/** Forget an account's session on this phone, without telling the server (after it's discarded). */
export function forgetSession(slot: string): void {
  removeAccount(slot);
}
