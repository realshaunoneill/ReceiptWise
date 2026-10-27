import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSessionUser, signInWithApple, signInWithGoogle, signInWithPassword, signOut, type SessionUser } from '../auth/auth';
import { unregisterPush } from '../push/push';
import { persistOptions } from '../query/client';

/** The signed-in person (null when signed out), from the server's session. */
export function useSession() {
  return useQuery<SessionUser | null>({
    queryKey: ['session'],
    queryFn: getSessionUser,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

function useSignIn<T>(signIn: (input: T) => Promise<boolean | void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signIn,
    onSuccess: async (result) => {
      if (result === false) return; // backed out of the sheet
      // Whoever was signed in before (if anyone), their data goes.
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
      await queryClient.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export const useGoogleSignIn = () => useSignIn(signInWithGoogle);
export const useAppleSignIn = () => useSignIn(signInWithApple);
export const usePasswordSignIn = () => useSignIn(({ email, password }: { email: string; password: string }) => signInWithPassword(email, password));

/** Sign out here and on the server, and forget everything this account loaded. */
export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    // The phone's push token goes first, while the session can still say whose it is.
    mutationFn: async () => {
      await unregisterPush();
      await signOut();
    },
    onSettled: async () => {
      queryClient.clear();
      await persistOptions.persister.removeClient();
      queryClient.setQueryData(['session'], null);
    },
  });
}
