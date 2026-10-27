import { useEffect } from 'react';
import { useRootNavigationState, useRouter, type Href } from 'expo-router';
import { routeForLink } from '../links';
import { Notifications } from './native';
import { registerPush } from './push';

/**
 * Push, while someone is signed in (mounted by src/components/SignedInEffects.tsx): the token is
 * registered again on every launch (if notifications are already allowed: nothing is asked here),
 * and a tapped notification opens its screen, including the one that launched the app.
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
    const open = (data: Record<string, unknown> | undefined) => {
      const url = typeof data?.url === 'string' ? data.url : null;
      if (!url) return;
      router.push((routeForLink(url) ?? url) as Href);
    };
    // The notification that launched the app, once.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      open(response.notification.request.content.data);
      void Notifications?.clearLastNotificationResponseAsync?.();
    });
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => open(response.notification.request.content.data));
    return () => subscription.remove();
  }, [ready, router]);

  return null;
}
