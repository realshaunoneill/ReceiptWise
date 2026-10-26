import { useEffect, useRef } from 'react';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useMe } from '../hooks/useMe';
import { takePendingInvite } from '../invites';

/**
 * What opens by itself once someone is signed in, once per sign-in: an invitation link they
 * opened while signed out (src/invites.ts), or else, on a first sign-in, the welcome and currency
 * step (app/onboarding.tsx). Mounted by app/_layout.tsx only while signed in. The invitation goes
 * first; accepting it goes on to the welcome if that's still to do.
 */
export default function SignedInEffects() {
  const router = useRouter();
  const me = useMe();
  const navigation = useRootNavigationState();
  const done = useRef(false);
  // Only a fresh answer (the copy kept on the phone may predate finishing it on the website), and
  // only once the navigator can take a push.
  const ready = me.isFetchedAfterMount && !!me.data && !!navigation?.key;

  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    void takePendingInvite().then((token) => {
      if (token) router.push({ pathname: '/invite/[token]', params: { token } });
      else if (!me.data?.onboardingCompletedAt) router.push('/onboarding');
    });
  }, [ready, me.data, router]);

  return null;
}
