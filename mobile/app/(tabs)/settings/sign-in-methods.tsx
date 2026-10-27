import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { KeyRound, Plus } from 'lucide-react-native';
import { formatDisplayDate } from '@shared/receipts/format';
import { appleSignInAvailable, signInUnavailable, type LinkedAccount } from '../../../src/auth/auth';
import { choose, confirm } from '../../../src/confirm';
import { useLinkAccount, useLinkedAccounts, useUnlinkAccount } from '../../../src/hooks/useAccount';
import { GUTTER, space } from '../../../src/theme';
import { success } from '../../../src/ui/Button';
import { LoadError, Notice, Skeleton } from '../../../src/ui/Feedback';
import Row from '../../../src/ui/Row';
import { List, Section } from '../../../src/ui/Section';
import TabScreen from '../../../src/ui/TabScreen';
import Text from '../../../src/ui/Text';

const PROVIDER: Record<string, string> = { google: 'Google', apple: 'Apple', credential: 'Password' };
const nameOf = (account: Pick<LinkedAccount, 'providerId'>) => PROVIDER[account.providerId] ?? account.providerId;

/**
 * The ways into this account. Adding Apple to an account made with Google (or the other way)
 * means either signs in to the same receipts; that's how someone who first signed in with Apple's
 * hidden email moves over to their Google account (app/sign-in.tsx). The last one can't be removed.
 */
export default function SignInMethods() {
  const accounts = useLinkedAccounts();
  const link = useLinkAccount();
  const unlink = useUnlinkAccount();
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    void appleSignInAvailable().then(setAppleAvailable);
  }, []);

  const list = accounts.data ?? [];
  const has = (provider: string) => list.some((account) => account.providerId === provider);
  const canAddGoogle = !has('google') && !signInUnavailable && Platform.OS !== 'web';
  const canAddApple = !has('apple') && appleAvailable;

  const manage = async (account: LinkedAccount) => {
    if (list.length <= 1) return;
    const index = await choose(`Sign in with ${nameOf(account)}`, [{ label: `Remove ${nameOf(account)}`, destructive: true }]);
    if (index !== 0) return;
    const ok = await confirm(`Remove ${nameOf(account)}?`, `You won't be able to sign in with ${nameOf(account)} any more. Your receipts stay in the account.`, 'Remove');
    if (ok) unlink.mutate(account, { onSuccess: success });
  };

  const error = link.error ?? unlink.error;

  return (
    <TabScreen onRefresh={() => accounts.refetch()}>
      <View style={{ marginHorizontal: GUTTER + space.xs, marginBottom: space.xl }}>
        <Text variant="callout" ink="secondary">Any of these signs you in to the same account, with the same receipts.</Text>
      </View>

      {!!error && (
        <Section>
          <Notice tone="bad" title="That didn't work">{error.message}</Notice>
        </Section>
      )}

      {accounts.isError && !accounts.data ? (
        <LoadError message={accounts.error.message} onRetry={() => void accounts.refetch()} />
      ) : !accounts.data ? (
        <Section><Skeleton height={100} round={12} /></Section>
      ) : (
        <Section footer={list.length <= 1 ? "This is the only way into your account, so it can't be removed." : undefined}>
          <List inset={52}>
            {list.map((account) => (
              <Row
                key={account.id}
                icon={KeyRound}
                label={nameOf(account)}
                detail={`Added ${formatDisplayDate(account.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}`}
                onPress={list.length > 1 && account.providerId !== 'credential' ? () => void manage(account) : undefined}
              />
            ))}
            {canAddGoogle && (
              <Row icon={Plus} label={link.isPending && link.variables === 'google' ? 'Adding Google…' : 'Add Google'} accent onPress={link.isPending ? undefined : () => link.mutate('google', { onSuccess: (added) => added && success() })} />
            )}
            {canAddApple && (
              <Row icon={Plus} label={link.isPending && link.variables === 'apple' ? 'Adding Apple…' : 'Add Sign in with Apple'} accent onPress={link.isPending ? undefined : () => link.mutate('apple', { onSuccess: (added) => added && success() })} />
            )}
          </List>
        </Section>
      )}
    </TabScreen>
  );
}
