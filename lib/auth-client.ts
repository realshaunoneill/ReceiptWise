'use client';

import { createAuthClient } from 'better-auth/react';

/** Better Auth in the browser. Same-origin, so no baseURL: it works on www, staging and localhost alike. */
export const authClient = createAuthClient();

export const { useSession, signOut } = authClient;

/** Sign out and leave the app with a full page load, so no cached data from the session survives. */
export async function signOutAndLeave() {
  await authClient.signOut();
  window.location.assign('/');
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
