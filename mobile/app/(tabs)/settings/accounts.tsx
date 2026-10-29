import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, LogOut, UserPlus, UserRound } from 'lucide-react-native';
import { firstName, type Account } from '../../../src/auth/account-list';
import { useAccounts } from '../../../src/auth/accounts';
import { confirm } from '../../../src/confirm';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { switchAccount, useSignOut } from '../../../src/hooks/useSession';
import { itemsFor } from '../../../src/upload/queue';
import { getQueue } from '../../../src/upload/runner';
import { GUTTER, space } from '../../../src/theme';
import { selectionTick } from '../../../src/ui/Button';
import { Notice } from '../../../src/ui/Feedback';
import Row from '../../../src/ui/Row';
import { List, Section } from '../../../src/ui/Section';
import TabScreen from '../../../src/ui/TabScreen';
import Text from '../../../src/ui/Text';

/**
 * Everyone signed in on this device: a household sharing an iPad keeps each person signed in,
 * each with their own receipts, plan and notifications, and switches between them here or from
 * Home's header. Switching asks for no passcode (Shaun, 2026-10-29); app lock still covers the app.
 */
export default function Accounts() {
  const router = useRouter();
  const { colors } = useTheme();
  const { active, accounts } = useAccounts();
  const signOut = useSignOut();

  const leave = async (account: Account) => {
    const name = firstName(account);
    const waiting = itemsFor(getQueue(), account.slot).filter((item) => item.status !== 'done').length;
    const message = waiting > 0
      ? `${waiting === 1 ? `1 of ${name}'s receipts hasn't` : `${waiting} of ${name}'s receipts haven't`} uploaded yet and will be lost.`
      : `${name} can sign in again any time.`;
    if (await confirm(`Sign out of ${name}?`, message, 'Sign out')) signOut.mutate(account.slot);
  };

  return (
    <TabScreen>
      <View style={{ marginHorizontal: GUTTER + space.xs, marginBottom: space.xl }}>
        <Text variant="callout" ink="secondary">
          Everyone in your household can be signed in here, each with their own receipts, plan and notifications. Switch between you at any time.
        </Text>
      </View>

      {!!signOut.error && (
        <Section>
          <Notice tone="bad" title="That didn't work">{signOut.error.message}</Notice>
        </Section>
      )}

      <Section title="On this device">
        <List inset={52}>
          {accounts.map((account) => (
            <Row
              key={account.slot}
              icon={UserRound}
              label={account.name || account.email || 'Account'}
              detail={account.name ? account.email : undefined}
              value={account.slot === active ? <Check size={20} color={colors.accent} accessibilityLabel="On screen" /> : undefined}
              onPress={account.slot === active ? undefined : () => {
                selectionTick();
                switchAccount(account.slot);
              }}
              accessibilityHint={account.slot === active ? undefined : `Switches to ${firstName(account)}'s account`}
            />
          ))}
          <Row icon={UserPlus} label="Add an account" accent onPress={() => router.push('/add-account')} />
        </List>
      </Section>

      <Section footer="Signing out of one account leaves everyone else signed in.">
        <List inset={52}>
          {accounts.map((account) => (
            <Row
              key={account.slot}
              icon={LogOut}
              label={`Sign out of ${firstName(account)}`}
              accent
              onPress={signOut.isPending ? undefined : () => void leave(account)}
            />
          ))}
        </List>
      </Section>
    </TabScreen>
  );
}
