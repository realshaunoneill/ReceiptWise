import React, { useEffect, useRef } from 'react';
import { useRootNavigationState, useRouter } from 'expo-router';
import { activeSlot, updateAccount } from '../auth/accounts';
import { refreshOtherSessions } from '../auth/auth';
import { useMe } from '../hooks/useMe';
import { accountEnded } from '../hooks/useSession';
import { takePendingInvite } from '../invites';
import { configurePurchases } from '../purchases';
import PushEffects from '../push/PushEffects';

/**
 * What opens by itself once someone is signed in, once per sign-in: an invitation link they
 * opened while signed out (src/invites.ts), or else, on a first sign-in, the welcome and currency
 * step (app/onboarding.tsx). Mounted by app/_layout.tsx only while signed in. The invitation goes
 * first; accepting it goes on to the welcome if that's still to do. It also tells RevenueCat who
 * is signed in, so in-app purchases are theirs. The app mounts this afresh for each account put on
 * screen (app/_layout.tsx), so all of it happens again after switching to someone else.
 */
export default function SignedInEffects() {
  const router = useRouter();
  const me = useMe();
  const navigation = useRootNavigationState();
  const done = useRef(false);
  // Only a fresh answer (the copy kept on the phone may predate finishing it on the website), and
  // only once the navigator can take a push.
  const ready = me.isFetchedAfterMount && !!me.data && !!navigation?.key;

  // In-app purchases are this person's, under their users.id (src/purchases).
  const userId = me.data?.id;
  useEffect(() => {
    if (!userId) return;
    void configurePurchases(userId).catch(() => undefined);
    // Notifications say whose they are by this id (src/push/PushEffects.tsx).
    const slot = activeSlot();
    if (slot) updateAccount(slot, { userId });
  }, [userId]);

  // Everyone else signed in here: their sessions are kept alive, and any that ended are forgotten.
  useEffect(() => {
    void refreshOtherSessions().then((ended) => ended.forEach((slot) => void accountEnded(slot)));
  }, []);

  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    void takePendingInvite().then((token) => {
      if (token) router.push({ pathname: '/invite/[token]', params: { token } });
      else if (!me.data?.onboardingCompletedAt) router.push('/onboarding');
    });
  }, [ready, me.data, router]);

  return <PushEffects />;
}
