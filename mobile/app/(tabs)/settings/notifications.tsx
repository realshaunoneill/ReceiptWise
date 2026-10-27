import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, View } from 'react-native';
import { NOTIFICATION_GROUPS, type NotificationPrefs } from '@shared/push/prefs';
import { useNotificationSettings, useUpdateNotificationPrefs } from '../../../src/hooks/useNotifications';
import { pushPermission, registerPush, type PushPermission } from '../../../src/push/push';
import Button from '../../../src/ui/Button';
import { LoadError, Notice, Skeleton } from '../../../src/ui/Feedback';
import { SwitchField } from '../../../src/ui/Form';
import { Section } from '../../../src/ui/Section';
import TabScreen from '../../../src/ui/TabScreen';
import { space } from '../../../src/theme';

/**
 * Which notifications to get, as on the website's Settings: a switch per kind, and hiding amounts
 * on the lock screen. Above them, whether this phone can get them at all, and the way to fix it.
 */
export default function NotificationSettings() {
  const settings = useNotificationSettings();
  const update = useUpdateNotificationPrefs();
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [asking, setAsking] = useState(false);

  const check = useCallback(() => {
    void pushPermission().then(setPermission).catch(() => setPermission('unavailable'));
  }, []);
  useEffect(() => {
    check();
    // Coming back from the phone's Settings with them turned on.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => subscription.remove();
  }, [check]);

  // While a switch saves, show it as changed.
  const saving = update.isPending ? update.variables : undefined;
  const value = (key: keyof NotificationPrefs) => saving?.[key] ?? settings.data?.prefs[key] ?? false;

  const turnOn = async () => {
    setAsking(true);
    try {
      setPermission(await registerPush({ ask: true }));
      void settings.refetch();
    } finally {
      setAsking(false);
    }
  };

  return (
    <TabScreen onRefresh={() => settings.refetch()}>
      <Section>
        {permission === 'granted' && <Notice tone="good" title="On for this phone">The ones switched on below come here.</Notice>}
        {permission === 'undetermined' && (
          <>
            <Notice tone="neutral" title="Notifications are off">Turn them on to hear when a receipt has been read, a bill is due, and on payday.</Notice>
            <Button label="Turn on notifications" loading={asking} onPress={() => void turnOn()} style={{ marginTop: space.md }} />
          </>
        )}
        {permission === 'denied' && (
          <>
            <Notice tone="warn" title="Notifications are turned off for ReceiptWise">{`Turn them on in your phone's Settings${Platform.OS === 'ios' ? ', under Notifications' : ''}.`}</Notice>
            <Button label="Open Settings" variant="secondary" onPress={() => void Linking.openSettings()} style={{ marginTop: space.md }} />
          </>
        )}
        {permission === 'unavailable' && (
          <Notice tone="neutral" title="Not in this version of the app">
            {Platform.OS === 'web' ? 'Notifications come to the app on a phone.' : 'The next version of the app can get notifications. These settings are kept for then.'}
          </Notice>
        )}
      </Section>

      {settings.isError && !settings.data ? (
        <LoadError message={settings.error.message} onRetry={() => void settings.refetch()} />
      ) : !settings.data ? (
        <Section><Skeleton height={240} /></Section>
      ) : (
        <>
          <Section title="Tell me about" footer="Quiet from 21:30 to 08:00, except for what you've just done yourself, like a receipt you photographed. What's held comes at 8.">
            <View style={{ gap: space.sm }}>
              {NOTIFICATION_GROUPS.map((group) => (
                <SwitchField
                  key={group.key}
                  label={group.label}
                  detail={group.detail}
                  value={value(group.key)}
                  onChange={(on) => update.mutate({ [group.key]: on })}
                />
              ))}
            </View>
          </Section>
          <Section title="Privacy">
            <SwitchField
              label="Hide amounts"
              detail="Leave amounts out of notifications, so nothing on the lock screen says how much"
              value={value('hideAmounts')}
              onChange={(on) => update.mutate({ hideAmounts: on })}
            />
          </Section>
          {!!update.error && <Section><Notice tone="bad" title="That didn't save">{update.error.message}</Notice></Section>}
        </>
      )}
    </TabScreen>
  );
}
