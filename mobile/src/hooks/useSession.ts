import { useMutation, useQuery } from '@tanstack/react-query';
import { activeAccount } from '../auth/account-list';
import { activeSlot, getAccounts, removeAccount, setActiveAccount } from '../auth/accounts';
import { getSessionUser, signInWithPassword, signOut, type SessionUser } from '../auth/auth';
import { resetPurchases } from '../purchases';
import { unregisterPush } from '../push/push';
import { queryClient, removeSavedQueries } from '../query/client';
import { clearQuickActions } from '../quickActions';
import { forgetScope } from '../scope';
import { clearQueue } from '../upload/runner';

/**
 * Who is on screen, and signing in, switching and signing out with everything on the phone that
 * belongs to an account. Several can be signed in (a household sharing an iPad, src/auth/accounts.ts);
 * whenever the one on screen changes, app/_layout.tsx starts the app afresh as them.
 */

/** The account as last known, for the moment before the server answers. */
function knownUser(slot: string | null): SessionUser | null {
  const account = activeAccount(getAccounts());
  if (!slot || account?.slot !== slot || !account.authUserId) return null;
  return { id: account.authUserId, name: account.name ?? '', email: account.email ?? '', image: account.image };
}

/**
 * The person on screen (null when signed out), from the server's session. When the server can't be
 * asked (offline at launch), the account as last known, rather than the sign-in screen.
 */
export function useSession() {
  return useQuery<SessionUser | null>({
    queryKey: ['session'],
    queryFn: async () => {
      const slot = activeSlot();
      try {
        const user = await getSessionUser();
        // Their session ended (expired, or signed out on the website): the next account takes over.
        if (!user && slot) await accountEnded(slot);
        return user;
      } catch (error) {
        const known = knownUser(slot);
        if (known) return known;
        throw error;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

/** Switching accounts: who is on screen is known already, so the app opens straight away as them. */
export function seedSession(slot: string | null) {
  const known = knownUser(slot);
  if (known) queryClient.setQueryData<SessionUser | null>(['session'], known, { updatedAt: 0 });
}

/** Put an account signed in here on screen: after signing in, or switching to someone else. */
export function switchAccount(slot: string) {
  setActiveAccount(slot);
}

/** Forget what the phone keeps of an account that's signed out: its captures, its choices, its data. */
async function forgetAccount(slot: string) {
  removeAccount(slot);
  clearQueue(slot);
  forgetScope(slot);
  await removeSavedQueries(slot);
  if (getAccounts().accounts.length === 0) {
    clearQuickActions();
    await resetPurchases();
  }
}

/** An account's session ended without signing out here: forget it, and the next account takes over. */
export async function accountEnded(slot: string): Promise<void> {
  await forgetAccount(slot);
}

/** Sign out of one account here and on the server; anyone else signed in here stays signed in. */
export async function signOutOf(slot: string): Promise<void> {
  // The phone's push token goes first, while the session can still say whose it is.
  await unregisterPush(slot, getAccounts().accounts.length <= 1);
  await signOut(slot);
  await forgetAccount(slot);
}

/** Sign out of an account (the one on screen unless given another). */
export function useSignOut() {
  return useMutation({
    mutationFn: async (slot?: string) => {
      const target = slot ?? activeSlot();
      if (target) await signOutOf(target);
    },
  });
}

/** Test accounts' password sign-in (the web preview and the e2e build); the account goes on screen. */
export function usePasswordSignIn() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => signInWithPassword(email, password),
    onSuccess: (slot) => switchAccount(slot),
  });
}
