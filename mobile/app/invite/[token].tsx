import React from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Users, X } from 'lucide-react-native';
import { formatDisplayDate } from '@shared/receipts/format';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useInvitePreview, useRespondToInvite } from '../../src/hooks/useInvitations';
import { useMe } from '../../src/hooks/useMe';
import { switchAccount, useSession } from '../../src/hooks/useSession';
import { activeAccount, firstName } from '../../src/auth/account-list';
import { useAccounts } from '../../src/auth/accounts';
import { choose } from '../../src/confirm';
import { INVITE_TOKEN, rememberInvite } from '../../src/invites';
import { GUTTER, radius, readableColumn, space } from '../../src/theme';
import Button, { success } from '../../src/ui/Button';
import { Notice, Skeleton } from '../../src/ui/Feedback';
import Text from '../../src/ui/Text';

/** Why an invitation can't be taken up any more (the website's app/invite/[token]/page.tsx). */
const CLOSED: Record<string, string> = {
  accepted: 'This invitation has already been accepted.',
  declined: 'This invitation was declined.',
  revoked: 'This invitation was withdrawn by the household owner.',
  expired: 'This invitation has expired. Ask the person who invited you for a new link.',
};

/**
 * An invitation link, opened in the app: reachable signed in or out (app/_layout.tsx). Signed out,
 * it shows the household and keeps the link while you sign in, then opens again
 * (src/components/SignedInEffects.tsx). Signed in, join or decline, as the person on screen or,
 * on a household's shared iPad, as someone else signed in there (or about to be): the link is kept
 * the same way and opens again once the app is theirs.
 */
export default function Invite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const session = useSession();
  const signedIn = !!session.data;
  const me = useMe(signedIn);
  const valid = !!token && INVITE_TOKEN.test(token);
  const preview = useInvitePreview(valid ? token : undefined);
  const respond = useRespondToInvite(token ?? '');

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const answer = (action: 'accept' | 'decline') => respond.mutate(action, {
    onSuccess: () => {
      if (action === 'accept') success();
      // A first sign-in through an invitation still gets the currency step.
      if (me.data && !me.data.onboardingCompletedAt) router.replace('/onboarding');
      else router.replace(action === 'accept' ? '/settings/households' : '/');
    },
  });

  const signInFirst = async () => {
    await rememberInvite(token!);
    router.replace('/sign-in');
  };

  const accounts = useAccounts();
  const current = activeAccount(accounts);
  const joinAsSomeoneElse = async () => {
    const others = accounts.accounts.filter((account) => account.slot !== accounts.active);
    const index = await choose('Join as', [...others.map((account) => ({ label: account.name || account.email || 'Account' })), { label: 'Add an account' }]);
    if (index === null) return;
    await rememberInvite(token!);
    if (index < others.length) switchAccount(others[index].slot);
    else router.push('/add-account');
  };

  const invitation = preview.data;
  const open = invitation?.status === 'pending';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xl }}>
      <View style={{ ...readableColumn, paddingHorizontal: GUTTER }}>
        <Pressable
          onPress={close}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.cardPressed : colors.card })}
        >
          <X size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ ...readableColumn, paddingHorizontal: GUTTER, paddingTop: space.xxl, gap: space.lg }}>
        {!valid || preview.isError ? (
          <>
            <Text variant="largeTitle" accessibilityRole="header">This link isn't valid</Text>
            <Text variant="callout" ink="secondary">Check you copied the whole link, or ask the person who invited you to send it again.</Text>
          </>
        ) : !invitation ? (
          <View style={{ gap: space.md }}>
            <Skeleton width="70%" height={32} />
            <Skeleton height={60} />
          </View>
        ) : !open ? (
          <>
            <Text variant="largeTitle" accessibilityRole="header">{invitation.householdName}</Text>
            <Text variant="callout" ink="secondary">{CLOSED[invitation.status] ?? 'This invitation is no longer open.'}</Text>
            <Button label={signedIn ? 'Go to Households' : 'Close'} variant="secondary" onPress={() => (signedIn ? router.replace('/settings/households') : close())} />
          </>
        ) : (
          <>
            <View style={{ width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Users size={24} color={colors.accent} />
            </View>
            <Text variant="largeTitle" accessibilityRole="header">{`Join ${invitation.householdName}`}</Text>
            <Text variant="body" ink="secondary">
              {`${invitation.invitedByEmail ?? 'Someone'} has invited you to share receipts in this household. The link works until ${formatDisplayDate(invitation.expiresAt, { day: 'numeric', month: 'long' })}.`}
            </Text>
            <Text variant="callout" ink="muted">
              Joining is free. Once you're in you can see the household's receipts, and, if another member has Premium, its shared bills and monthly plan too. Adding receipts of your own needs your own Premium.
            </Text>
            {!!respond.error && <Notice tone="bad" title="That didn't work">{respond.error.message}</Notice>}
            {signedIn ? (
              <View style={{ gap: space.md, marginTop: space.md }}>
                <Button label="Join household" loading={respond.isPending && respond.variables === 'accept'} disabled={respond.isPending} onPress={() => answer('accept')} />
                <Button label="Decline" variant="secondary" loading={respond.isPending && respond.variables === 'decline'} disabled={respond.isPending} onPress={() => answer('decline')} />
                {Platform.OS !== 'web' && !!current && (
                  <>
                    <Text variant="footnote" ink="muted" align="center">{`Joining as ${firstName(current)}${current.email ? ` (${current.email})` : ''}.`}</Text>
                    <Button label="Join as someone else" variant="plain" disabled={respond.isPending} onPress={() => void joinAsSomeoneElse()} />
                  </>
                )}
              </View>
            ) : (
              <View style={{ gap: space.sm, marginTop: space.md }}>
                <Button label="Sign in to accept" onPress={() => void signInFirst()} />
                <Text variant="footnote" ink="muted" align="center">You'll come straight back here to accept once you're signed in.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
