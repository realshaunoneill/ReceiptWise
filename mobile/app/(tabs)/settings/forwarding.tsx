import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { CircleCheck, Copy, RefreshCw } from 'lucide-react-native';
import { type WireInboundEmail } from '@shared/api/inbound';
import { confirm } from '../../../src/confirm';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { useInboundAddress, useInboundEmails, useRotateInboundAddress } from '../../../src/hooks/useAccount';
import { GUTTER, radius, space, type Tone } from '../../../src/theme';
import Button, { success } from '../../../src/ui/Button';
import { LoadError, Notice, Pill, Skeleton } from '../../../src/ui/Feedback';
import { Card, List, Section } from '../../../src/ui/Section';
import TabScreen from '../../../src/ui/TabScreen';
import Text from '../../../src/ui/Text';

/** What happened to a forwarded email (the website's email-forwarding-card.tsx). */
const STATUS: Record<string, { label: string; tone: Tone }> = {
  receiving: { label: 'Arriving', tone: 'neutral' },
  stored: { label: 'Reading', tone: 'neutral' },
  processed: { label: 'Read', tone: 'good' },
  no_content: { label: 'Nothing to read', tone: 'warn' },
  rejected_limit: { label: 'Over the daily limit', tone: 'warn' },
  forwarding_confirmation: { label: 'Forwarding confirmation', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'bad' },
};

/** Today's time, or the day: in the phone's own time zone. */
function received(iso: string): string {
  const at = new Date(iso);
  return at.toDateString() === new Date().toDateString()
    ? at.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
    : at.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

/**
 * The forwarding address: send a bill or receipt to it, or set a rule in Gmail or Outlook to, and
 * its attachments are read into the plan or Receipts. Gmail asks for a confirmation before a
 * forwarding rule starts; its code shows here.
 */
export default function Forwarding() {
  const { colors } = useTheme();
  const address = useInboundAddress();
  const emails = useInboundEmails();
  const rotate = useRotateInboundAddress();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!address.data) return;
    await Clipboard.setStringAsync(address.data.address);
    success();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const makeNew = async () => {
    const ok = await confirm('Make a new address?', 'Mail to the current address stops being accepted. Update any forwarding rules to use the new one.', 'Make a new address');
    if (ok) rotate.mutate(undefined, { onSuccess: success });
  };

  const list = emails.data ?? [];
  const confirmation = list.find((email) => email.status === 'forwarding_confirmation');

  return (
    <TabScreen onRefresh={() => void Promise.all([address.refetch(), emails.refetch()])} refreshing={address.isRefetching}>
      <View style={{ marginHorizontal: GUTTER + space.xs, marginBottom: space.xl }}>
        <Text variant="callout" ink="secondary">
          Forward a bill or receipt to this address, or set up a rule in your email to forward them for you. Attachments are read and land in your plan, or in Receipts.
        </Text>
      </View>

      <Section footer="Anyone with this address can send to your account, so keep it to forwarding rules. If it gets out, make a new one.">
        {address.isError && !address.data ? (
          <LoadError message={address.error.message} onRetry={() => void address.refetch()} />
        ) : (
          <Card padded>
            {address.data ? (
              <Text variant="body" weight="monoMedium" selectable accessibilityLabel={`Your forwarding address: ${address.data.address}`}>
                {address.data.address}
              </Text>
            ) : (
              <Skeleton height={22} />
            )}
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
              <Button label={copied ? 'Copied' : 'Copy'} icon={Copy} size="sm" variant="secondary" disabled={!address.data} onPress={() => void copy()} style={{ flex: 1 }} />
              <Button label="Make a new address" icon={RefreshCw} size="sm" variant="plain" loading={rotate.isPending} onPress={() => void makeNew()} />
            </View>
            {!!rotate.error && <Text variant="footnote" ink="bad" style={{ marginTop: space.sm }}>{rotate.error.message}</Text>}
          </Card>
        )}
      </Section>

      {!!confirmation && (
        <Section>
          <Notice tone="neutral" title="Gmail wants you to confirm forwarding">
            <View style={{ gap: space.xs }}>
              {!!confirmation.confirmationCode && (
                <Text variant="footnote" ink="secondary">
                  {'Code: '}
                  <Text variant="footnote" weight="monoMedium" selectable>{confirmation.confirmationCode}</Text>
                </Text>
              )}
              {!!confirmation.confirmationUrl && (
                <Text variant="footnote" ink="accent" onPress={() => void Linking.openURL(confirmation.confirmationUrl!)} accessibilityRole="link">Confirm in Gmail</Text>
              )}
            </View>
          </Notice>
        </Section>
      )}

      <Section title="Recent">
        {list.length > 0 ? (
          <List inset={space.lg}>
            {list.slice(0, 12).map((email) => <EmailRow key={email.id} email={email} />)}
          </List>
        ) : emails.data ? (
          <View style={{ padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border }}>
            <Text variant="callout" ink="muted" align="center">Nothing forwarded yet. Emails sent to this address show up here as they arrive.</Text>
          </View>
        ) : (
          <Skeleton height={60} round={radius.lg} />
        )}
      </Section>
    </TabScreen>
  );
}

function EmailRow({ email }: { email: WireInboundEmail }) {
  const { colors } = useTheme();
  const status = STATUS[email.status] ?? { label: email.status, tone: 'neutral' as Tone };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56 }}>
      {email.status === 'processed' && <CircleCheck size={18} color={colors.good} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" numberOfLines={1}>{email.subject || email.fromAddress || 'Email'}</Text>
        <Text variant="footnote" ink="muted" numberOfLines={1}>
          {[received(email.receivedAt), email.status === 'failed' ? email.error : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Pill label={status.label} tone={status.tone} />
    </View>
  );
}
