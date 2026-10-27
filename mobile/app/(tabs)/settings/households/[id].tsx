import React from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Clock, Crown, LogOut, Pencil, Trash2, User, UserPlus } from 'lucide-react-native';
import { type WireHouseholdMember, type WireSentInvitation } from '@shared/api/households';
import { formatDisplayDate } from '@shared/receipts/format';
import { choose, confirm } from '../../../../src/confirm';
import { useDeleteHousehold, useHousehold, useLeaveHousehold, useRemoveMember, useRevokeInvitation, useSentInvitations, useTransferOwnership } from '../../../../src/hooks/useHouseholds';
import { useMe } from '../../../../src/hooks/useMe';
import { shareInvite } from '../../../../src/invites';
import { GUTTER, radius, space } from '../../../../src/theme';
import { success } from '../../../../src/ui/Button';
import { LoadError, Notice, Pill, Skeleton } from '../../../../src/ui/Feedback';
import Row from '../../../../src/ui/Row';
import { List, Section } from '../../../../src/ui/Section';
import TabScreen from '../../../../src/ui/TabScreen';
import Text from '../../../../src/ui/Text';

const displayName = (member: WireHouseholdMember) => member.name || member.email.split('@')[0];
const shortDay = (iso: string) => formatDisplayDate(iso, { day: 'numeric', month: 'short' });

/**
 * One household: who's in it, invitations still open, and what you can do as its owner (invite,
 * hand it over, remove someone, rename, delete) or as a member (leave). Removing, handing over
 * and leaving are never behind Premium: a lapsed owner must still be able to wind it down.
 */
export default function Household() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const me = useMe();
  const query = useHousehold(id);
  const invitations = useSentInvitations(id);
  const transfer = useTransferOwnership(id);
  const remove = useRemoveMember(id);
  const revoke = useRevokeInvitation(id);
  const leave = useLeaveHousehold(id);
  const del = useDeleteHousehold(id);

  const household = query.data;
  if (!household) {
    return (
      <TabScreen>
        {query.isError ? <LoadError message={query.error.message} onRetry={() => void query.refetch()} /> : (
          <View style={{ marginHorizontal: GUTTER, gap: space.lg }}>
            <Skeleton height={160} round={radius.lg} />
            <Skeleton height={100} round={radius.lg} />
          </View>
        )}
      </TabScreen>
    );
  }

  const isOwner = household.isAdmin;
  const alone = household.members.length <= 1;
  const covered = !!me.data?.entitlements.householdIds.includes(household.id);
  const error = transfer.error ?? remove.error ?? revoke.error ?? leave.error ?? del.error;

  const manageMember = async (member: WireHouseholdMember) => {
    const index = await choose(displayName(member), [{ label: 'Make owner' }, { label: 'Remove from household', destructive: true }]);
    if (index === 0) {
      const ok = await confirm(
        `Make ${member.email} the owner?`,
        "You'll stay in the household as a member, and they'll be the one who can invite, remove and delete.",
        'Make owner',
      );
      if (ok) transfer.mutate(member.userId, { onSuccess: success });
    } else if (index === 1) {
      const ok = await confirm(`Remove ${member.email}?`, "Their receipts stay theirs and leave this household's view.", 'Remove');
      if (ok) remove.mutate(member.userId, { onSuccess: success });
    }
  };

  const manageInvitation = async (invitation: WireSentInvitation) => {
    const index = await choose(invitation.invitedEmail, [
      ...(invitation.inviteUrl ? [{ label: 'Share the link again' }] : []),
      { label: 'Withdraw invitation', destructive: true },
    ]);
    if (index === null) return;
    if (invitation.inviteUrl && index === 0) {
      void shareInvite(household.name, invitation.inviteUrl);
    } else {
      revoke.mutate(invitation.id);
    }
  };

  const leaveHousehold = async () => {
    const message = isOwner
      ? `You're the only one in ${household.name}, so leaving deletes it. Your receipts stay in your own view.`
      : `Receipts you added go back to your own view.`;
    if (!(await confirm(`Leave ${household.name}?`, message, 'Leave'))) return;
    leave.mutate(undefined, { onSuccess: () => navigation.goBack() });
  };

  const deleteHousehold = async () => {
    const ok = await confirm(
      `Delete ${household.name}?`,
      "Everyone is removed from it. Each person's receipts stay in their own view: nothing is deleted except the household.",
      'Delete',
    );
    if (ok) del.mutate(undefined, { onSuccess: () => navigation.goBack() });
  };

  const waiting = invitations.data ?? [];

  return (
    <>
      <Stack.Screen options={{ title: household.name }} />
      <TabScreen onRefresh={() => Promise.all([query.refetch(), invitations.refetch()])}>
        <View style={{ marginHorizontal: GUTTER + space.xs, marginBottom: space.xl, gap: space.xs }}>
          <Text variant="callout" ink="secondary">
            {covered
              ? 'Everyone here sees its shared receipts, bills and plan: someone in it has Premium.'
              : "Everyone here sees its shared receipts. Shared bills and the plan come with a member's Premium."}
          </Text>
        </View>

        {!!error && (
          <Section>
            <Notice tone="bad" title="That didn't work">{error.message}</Notice>
          </Section>
        )}

        <Section title={household.members.length === 1 ? '1 person' : `${household.members.length} people`}>
          <List inset={52}>
            {household.members.map((member) => {
              const you = member.userId === me.data?.id;
              const owner = member.role === 'owner';
              return (
                <Row
                  key={member.userId}
                  icon={owner ? Crown : User}
                  label={you ? `${displayName(member)} (you)` : displayName(member)}
                  detail={member.email}
                  value={owner ? <Pill label="Owner" tone="good" /> : undefined}
                  onPress={isOwner && !you ? () => void manageMember(member) : undefined}
                  accessibilityHint={isOwner && !you ? 'Make them the owner, or remove them' : undefined}
                />
              );
            })}
            {isOwner && !!me.data?.subscribed && (
              <Row icon={UserPlus} label="Invite someone" accent onPress={() => router.push({ pathname: '/sheets/household-invite', params: { id: household.id } })} />
            )}
          </List>
          {isOwner && !me.data?.subscribed && (
            <Text variant="footnote" ink="muted" style={{ marginTop: space.sm, paddingHorizontal: space.xs }}>Inviting people is part of Premium.</Text>
          )}
        </Section>

        {waiting.length > 0 && (
          <Section title="Waiting to join">
            <List inset={52}>
              {waiting.map((invitation) => (
                <Row
                  key={invitation.id}
                  icon={Clock}
                  label={invitation.invitedEmail}
                  detail={`Link works until ${shortDay(invitation.expiresAt)}`}
                  onPress={isOwner ? () => void manageInvitation(invitation) : undefined}
                />
              ))}
            </List>
          </Section>
        )}

        <Section footer={isOwner && !alone ? 'To leave, first make someone else the owner.' : undefined}>
          <List>
            {isOwner && <Row icon={Pencil} label="Rename" onPress={() => router.push({ pathname: '/sheets/household-rename', params: { id: household.id } })} />}
            {(!isOwner || alone) && <Row icon={LogOut} label="Leave household" destructive onPress={() => void leaveHousehold()} />}
            {isOwner && <Row icon={Trash2} label="Delete household" destructive onPress={() => void deleteHousehold()} />}
          </List>
        </Section>
      </TabScreen>
    </>
  );
}
