import { useEffect } from 'react';
import { useRootNavigationState, useRouter, type Href } from 'expo-router';
import { accountForUser } from '../auth/account-list';
import { activeSlot, getAccounts } from '../auth/accounts';
import { switchAccount } from '../hooks/useSession';
import { routeForLink } from '../links';
import { Notifications } from './native';
import { registerPush } from './push';

/** A tapped notification for someone else on the device: opened once the app is theirs. */
let pendingLink: string | null = null;
/** The launching notification is handled once, though this mounts again for each account put on screen. */
let launchHandled = false;

/**
 * Push, while someone is signed in (mounted by src/components/SignedInEffects.tsx): the token is
 * registered again on every launch (if notifications are already allowed: nothing is asked here),
 * and a tapped notification opens its screen, including the one that launched the app. On a
 * device signed in to several accounts, a notification for someone not on screen switches to them
 * first (no passcode: it's a household's own device); the app remounts as them and this opens the
 * screen then. One for an account no longer signed in here just opens the app.
 */
export default function PushEffects() {
  const router = useRouter();
  const navigation = useRootNavigationState();
  const ready = !!navigation?.key;

  useEffect(() => {
    void registerPush({ ask: false }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!Notifications || !ready) return undefined;
    const go = (url: string) => router.push((routeForLink(url) ?? url) as Href);
    const open = (data: Record<string, unknown> | undefined) => {
      const url = typeof data?.url === 'string' ? data.url : null;
      if (!url) return;
      if (typeof data?.userId === 'string') {
        const account = accountForUser(getAccounts(), data.userId);
        if (!account) return;
        if (account.slot !== activeSlot()) {
          pendingLink = url;
          switchAccount(account.slot);
          return;
        }
      }
      go(url);
    };
    if (pendingLink) {
      go(pendingLink);
      pendingLink = null;
    }
    // The notification that launched the app, once.
    if (!launchHandled) {
      launchHandled = true;
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response) return;
        void Notifications?.clearLastNotificationResponseAsync?.();
        open(response.notification.request.content.data);
      });
    }
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => open(response.notification.request.content.data));
    return () => subscription.remove();
  }, [ready, router]);

  return null;
}
