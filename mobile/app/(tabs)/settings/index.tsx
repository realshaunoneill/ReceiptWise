import React from 'react';
import * as Application from 'expo-application';
import * as WebBrowser from 'expo-web-browser';
import { CircleHelp, Coins, FileText, LogOut, Shield, Trash2, Crown } from 'lucide-react-native';
import { getCurrencyDetails, SUPPORTED_CURRENCIES } from '@shared/currency';
import { formatDisplayDate } from '@shared/receipts/format';
import { SITE_URL } from '../../../src/config';
import { choose, confirm } from '../../../src/confirm';
import { useTheme, type ThemeMode } from '../../../src/contexts/ThemeContext';
import { useCancelDeletion, useMe, useScheduleDeletion, useUpdateCurrency } from '../../../src/hooks/useMe';
import { useSession, useSignOut } from '../../../src/hooks/useSession';
import { useUploadQueue } from '../../../src/upload/useUploadQueue';
import Button from '../../../src/ui/Button';
import { Segmented } from '../../../src/ui/Controls';
import { Notice } from '../../../src/ui/Feedback';
import Row from '../../../src/ui/Row';
import { Card, List, Section } from '../../../src/ui/Section';
import TabScreen from '../../../src/ui/TabScreen';
import Text from '../../../src/ui/Text';

export default function Settings() {
  const { themeMode, setThemeMode } = useTheme();
  const session = useSession();
  const me = useMe();
  const signOut = useSignOut();
  const currency = useUpdateCurrency();
  const schedule = useScheduleDeletion();
  const cancel = useCancelDeletion();
  const { items } = useUploadQueue();
  const open = (path: string) => void WebBrowser.openBrowserAsync(`${SITE_URL}${path}`);

  const pickCurrency = async () => {
    const index = await choose('Show totals in', SUPPORTED_CURRENCIES.map((c) => ({ label: `${c.name} (${c.symbol})` })));
    if (index !== null) currency.mutate(SUPPORTED_CURRENCIES[index].code);
  };

  const leave = async () => {
    const waiting = items.filter((item) => item.status !== 'done').length;
    const message = waiting > 0
      ? `${waiting === 1 ? "1 receipt hasn't" : `${waiting} receipts haven't`} uploaded yet and will be lost.`
      : 'You can sign in again any time.';
    if (await confirm('Sign out?', message, 'Sign out')) signOut.mutate();
  };

  const deleteAccount = async () => {
    const ok = await confirm(
      'Delete your account?',
      "Your receipts, bills and plan are deleted in 24 hours. Until then you can change your mind here. A subscription bought through the App Store or Google Play isn't cancelled by this: cancel it in your phone's settings.",
      'Delete account',
    );
    if (ok) schedule.mutate();
  };

  const premiumLabel = me.data?.subscribed ? 'Premium' : me.data?.entitlements.householdIds.length ? "Covered by your household's Premium" : 'Not on Premium';

  return (
    <TabScreen onRefresh={() => void me.refetch()} refreshing={me.isRefetching}>
      {me.data?.deletionScheduledAt && (
        <Section>
          <Notice tone="bad" title={`Your account is deleted on ${formatDisplayDate(me.data.deletionScheduledAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}>
            Everything in it goes then. Changed your mind?
          </Notice>
          <Button label="Keep my account" variant="secondary" loading={cancel.isPending} onPress={() => cancel.mutate()} style={{ marginTop: 12 }} />
        </Section>
      )}

      <Section title="Account">
        <List>
          <Row label={session.data?.name || 'Signed in'} detail={me.data?.email ?? session.data?.email} />
          <Row icon={Crown} label="Plan" value={premiumLabel} />
        </List>
      </Section>

      <Section title="Preferences">
        <List>
          <Row
            icon={Coins}
            label="Show totals in"
            value={me.data ? getCurrencyDetails(me.data.currency).name : ''}
            onPress={() => void pickCurrency()}
          />
        </List>
      </Section>

      <Section title="Appearance">
        <Card padded>
          <Segmented<ThemeMode>
            accessibilityLabel="Appearance"
            value={themeMode}
            onChange={setThemeMode}
            options={[{ value: 'system', label: 'Automatic' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
          />
        </Card>
      </Section>

      <Section title="Help and legal">
        <List>
          <Row icon={CircleHelp} label="Support" onPress={() => open('/support')} />
          <Row icon={Shield} label="Privacy Policy" onPress={() => open('/privacy')} />
          <Row icon={FileText} label="Terms" onPress={() => open('/terms')} />
        </List>
      </Section>

      <Section>
        <List>
          <Row icon={LogOut} label="Sign out" accent onPress={() => void leave()} />
          {!me.data?.deletionScheduledAt && <Row icon={Trash2} label="Delete account" destructive onPress={() => void deleteAccount()} />}
        </List>
      </Section>

      <Text variant="footnote" ink="muted" align="center">
        {`ReceiptWise ${Application.nativeApplicationVersion ?? ''}${Application.nativeBuildVersion ? ` (${Application.nativeBuildVersion})` : ''}`}
      </Text>
    </TabScreen>
  );
}
