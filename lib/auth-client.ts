'use client';

import { createAuthClient } from 'better-auth/react';
import { multiSessionClient } from 'better-auth/client/plugins';

/** Better Auth in the browser. Same-origin, so no baseURL: it works on www, staging and localhost alike. */
export const authClient = createAuthClient({ plugins: [multiSessionClient()] });

export const { useSession, signOut } = authClient;

/** An account signed in to this browser (lib/auth.ts multiSession), the current one included. */
export type BrowserAccount = { sessionToken: string; userId: string; name: string; email: string; image?: string | null };

export async function listBrowserAccounts(): Promise<BrowserAccount[]> {
  const { data } = await authClient.multiSession.listDeviceSessions();
  return (data ?? []).map(({ session, user }) => ({ sessionToken: session.token, userId: user.id, name: user.name, email: user.email, image: user.image }));
}

/**
 * Sign out and leave the app with a full page load, so no cached data from the session survives.
 * This signs out every account on the browser; signOutCurrentAccount leaves the others signed in.
 */
export async function signOutAndLeave() {
  await authClient.signOut();
  window.location.assign('/');
}

/** Switch to another account signed in here, with a full page load so nothing cached from the last one shows. */
export async function switchAccount(sessionToken: string) {
  const { error } = await authClient.multiSession.setActive({ sessionToken });
  if (error) throw new Error(error.message ?? "Couldn't switch account");
  window.location.assign('/dashboard');
}

/** Sign out of the current account only: the next one signed in here takes over, or else the home page. */
export async function signOutCurrentAccount(sessionToken: string, othersSignedIn: boolean) {
  await authClient.multiSession.revoke({ sessionToken });
  window.location.assign(othersSignedIn ? '/dashboard' : '/');
}

/** Off to sign someone else in, keeping the current account (lib/auth.ts adoptSession). */
export async function addAccount() {
  // A JSON body, or Better Auth answers a POST with 415.
  await authClient.$fetch('/multi-session/adopt', { method: 'POST', body: {} }).catch(() => undefined);
  window.location.assign('/sign-in?add=1');
}

/** Off to Google. `newUserCallbackURL` is where a first sign-in lands instead of `callbackURL`. */
export function signInWithGoogle(callbackURL: string, newUserCallbackURL?: string) {
  return authClient.signIn.social({ provider: 'google', callbackURL, newUserCallbackURL });
}

/** Development only: the server refuses it unless lib/dev-login.ts allows it. */
export function signInWithPassword(email: string, password: string, callbackURL = '/dashboard') {
  return authClient.signIn.email({ email, password, callbackURL });
}

export function signUpWithPassword(email: string, password: string, name: string, callbackURL = '/dashboard') {
  return authClient.signUp.email({ email, password, name, callbackURL });
}
