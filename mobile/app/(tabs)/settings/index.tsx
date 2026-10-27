import React, { useState } from 'react';
import { Switch } from 'react-native';
import * as Application from 'expo-application';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BarChart3, Bell, CircleHelp, Coins, Download, FileText, Home, KeyRound, Lock, LogOut, Mail, Shield, Trash2, Crown, Users } from 'lucide-react-native';
import { getCurrencyDetails, SUPPORTED_CURRENCIES } from '@shared/currency';
import { formatDisplayDate } from '@shared/receipts/format';
import { setConsent, useConsent } from '../../../src/analytics';
import { SITE_URL } from '../../../src/config';
import { choose, confirm } from '../../../src/confirm';
import { useTheme, type ThemeMode } from '../../../src/contexts/ThemeContext';
import { openPrivateFile } from '../../../src/files';
import { useSetDefaultHousehold } from '../../../src/hooks/useAccount';
import { useHouseholds } from '../../../src/hooks/useHouseholds';
import { useReceivedInvitations } from '../../../src/hooks/useInvitations';
import { useCancelDeletion, useMe, useScheduleDeletion, useUpdateCurrency } from '../../../src/hooks/useMe';
import { useSession, useSignOut } from '../../../src/hooks/useSession';
import { useUploadQueue } from '../../../src/upload/useUploadQueue';
import Button, { selectionTick, success } from '../../../src/ui/Button';
import { Segmented } from '../../../src/ui/Controls';
import { Notice } from '../../../src/ui/Feedback';
import Row from '../../../src/ui/Row';
import { Card, List, Section } from '../../../src/ui/Section';
import TabScreen from '../../../src/ui/TabScreen';
import Text from '../../../src/ui/Text';

/** The exports the website offers (Settings › Data), less the HTML one with images. */
const EXPORTS = [
  { label: 'Everything (CSV)', format: 'csv', type: 'all' },
  { label: 'Everything (JSON)', format: 'json', type: 'all' },
  { label: 'Receipts only (CSV)', format: 'csv', type: 'receipts' },
  { label: 'Bills and subscriptions only (CSV)', format: 'csv', type: 'subscriptions' },
] as const;

export default function Settings() {
  const router = useRouter();
  const { themeMode, setThemeMode, colors } = useTheme();
  const session = useSession();
  const me = useMe();
  const households = useHouseholds();
  const invitations = useReceivedInvitations();
  const consent = useConsent();
  const signOut = useSignOut();
  const currency = useUpdateCurrency();
  const defaultHousehold = useSetDefaultHousehold();
  const schedule = useScheduleDeletion();
  const cancel = useCancelDeletion();
  const { items } = useUploadQueue();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const open = (path: string) => void WebBrowser.openBrowserAsync(`${SITE_URL}${path}`);

  const pickCurrency = async () => {
    const index = await choose('Show totals in', SUPPORTED_CURRENCIES.map((c) => ({ label: `${c.name} (${c.symbol})` })));
    if (index !== null) currency.mutate(SUPPORTED_CURRENCIES[index].code);
  };

  const yourHouseholds = households.data ?? [];
  const defaultName = yourHouseholds.find((h) => h.id === me.data?.defaultHouseholdId)?.name ?? 'Just me';
  const pickDefaultHousehold = async () => {
    const options = [{ id: null as string | null, label: 'Just me' }, ...yourHouseholds.map((h) => ({ id: h.id, label: h.name }))];
    const index = await choose('New receipts go to', options.map((o) => ({ label: o.id === (me.data?.defaultHouseholdId ?? null) ? `${o.label} ✓` : o.label })));
    if (index !== null && options[index].id !== (me.data?.defaultHouseholdId ?? null)) defaultHousehold.mutate(options[index].id);
  };

  const exportData = async () => {
    const index = await choose('Export your data', EXPORTS.map((e) => ({ label: e.label })));
    if (index === null) return;
    const { format, type } = EXPORTS[index];
    setExporting(true);
    setExportError(null);
    try {
      const day = new Date().toISOString().slice(0, 10);
      await openPrivateFile(`/api/users/export?format=${format}&type=${type}`, `receiptwise-export-${day}`);
      success();
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Couldn't export your data");
    } finally {
      setExporting(false);
    }
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
  // Email forwarding is part of bills, which need Premium of your own or a household's.
  const canForward = !!me.data?.features.bills && (!!me.data.entitlements.personal || me.data.entitlements.householdIds.length > 0);
  const pending = invitations.data?.length ?? 0;
  const householdsValue = pending > 0
    ? (pending === 1 ? '1 invitation' : `${pending} invitations`)
    : yourHouseholds.length === 0 ? 'None' : yourHouseholds.length === 1 ? yourHouseholds[0].name : `${yourHouseholds.length}`;

  return (
    <TabScreen onRefresh={() => Promise.all([me.refetch(), households.refetch(), invitations.refetch()])}>
      {!!me.data?.deletionScheduledAt && (
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
          <Row icon={Crown} label="Plan" value={premiumLabel} onPress={() => router.push('/settings/subscription')} />
          <Row icon={KeyRound} label="Sign-in methods" onPress={() => router.push('/settings/sign-in-methods')} />
        </List>
      </Section>

      <Section title="Sharing" footer={yourHouseholds.length > 0 ? 'Where a receipt goes when you add it without choosing.' : undefined}>
        <List>
          <Row
            icon={Users}
            label="Households"
            value={householdsValue}
            tone={pending > 0 ? 'good' : undefined}
            onPress={() => router.push('/settings/households')}
          />
          {yourHouseholds.length > 0 && (
            <Row icon={Home} label="New receipts go to" value={defaultName} onPress={() => void pickDefaultHousehold()} />
          )}
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
          <Row icon={Bell} label="Notifications" onPress={() => router.push('/settings/notifications')} />
          {canForward && <Row icon={Mail} label="Email forwarding" detail="Forward bills and receipts to ReceiptWise" onPress={() => router.push('/settings/forwarding')} />}
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

      <Section title="Privacy and data" footer="Usage analytics show which features are used, so we know what to improve. They're off unless you turn them on, and never include what's on your receipts.">
        <List>
          <Row
            icon={BarChart3}
            label="Share usage analytics"
            value={(
              <Switch
                value={consent === 'granted'}
                onValueChange={(on) => {
                  selectionTick();
                  setConsent(on ? 'granted' : 'denied');
                }}
                trackColor={{ true: colors.accent, false: colors.border }}
                accessibilityLabel="Share usage analytics"
              />
            )}
          />
          <Row icon={Lock} label="Privacy & security" detail="Hide amounts, app lock" onPress={() => router.push('/settings/privacy')} />
          <Row icon={Download} label={exporting ? 'Exporting…' : 'Export your data'} accent onPress={exporting ? undefined : () => void exportData()} />
        </List>
        {!!exportError && <Text variant="footnote" ink="bad" style={{ marginTop: 8, paddingHorizontal: 4 }}>{exportError}</Text>}
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
