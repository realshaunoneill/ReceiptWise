import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Users } from 'lucide-react-native';
import { formatDisplayDate } from '@shared/receipts/format';
import { useHouseholds } from '../../../../src/hooks/useHouseholds';
import { useReceivedInvitations, useRespondToInvitation } from '../../../../src/hooks/useInvitations';
import { useMe } from '../../../../src/hooks/useMe';
import { space } from '../../../../src/theme';
import Button, { success } from '../../../../src/ui/Button';
import { EmptyState, LoadError, Skeleton } from '../../../../src/ui/Feedback';
import Row from '../../../../src/ui/Row';
import { Card, List, Section } from '../../../../src/ui/Section';
import TabScreen from '../../../../src/ui/TabScreen';
import Text from '../../../../src/ui/Text';

/**
 * Households: a shared pile of receipts, and, if someone in it has Premium, shared bills and a
 * plan. The ones you're in, invitations waiting for you, and making a new one (that needs Premium;
 * joining doesn't, and leaving never does).
 */
export default function Households() {
  const router = useRouter();
  const me = useMe();
  const households = useHouseholds();
  const invitations = useReceivedInvitations();
  const respond = useRespondToInvitation();
  const list = households.data ?? [];
  const canCreate = !!me.data?.subscribed;

  return (
    <TabScreen onRefresh={() => Promise.all([households.refetch(), invitations.refetch()])}>
      {(invitations.data?.length ?? 0) > 0 && (
        <Section title="Invitations">
          <View style={{ gap: space.md }}>
            {invitations.data!.map((invitation) => {
              const busy = respond.isPending && respond.variables?.id === invitation.id;
              return (
                <Card key={invitation.id} padded>
                  <Text variant="label">{`Join ${invitation.householdName ?? 'a household'}`}</Text>
                  <Text variant="footnote" ink="muted" style={{ marginTop: 2 }}>
                    {`${invitation.invitedByEmail ?? 'Someone'} invited you · until ${formatDisplayDate(invitation.expiresAt, { day: 'numeric', month: 'short' })}`}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
                    <Button
                      label="Join"
                      size="sm"
                      loading={busy && respond.variables?.action === 'accept'}
                      disabled={respond.isPending}
                      onPress={() => respond.mutate({ id: invitation.id, action: 'accept' }, { onSuccess: success })}
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Decline"
                      size="sm"
                      variant="secondary"
                      loading={busy && respond.variables?.action === 'decline'}
                      disabled={respond.isPending}
                      onPress={() => respond.mutate({ id: invitation.id, action: 'decline' })}
                      style={{ flex: 1 }}
                    />
                  </View>
                </Card>
              );
            })}
            {!!respond.error && <Text variant="footnote" ink="bad">{respond.error.message}</Text>}
          </View>
        </Section>
      )}

      {households.isError && !households.data ? (
        <LoadError message={households.error.message} onRetry={() => void households.refetch()} />
      ) : !households.data ? (
        <Section><Skeleton height={100} round={12} /></Section>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No households yet"
          body={canCreate
            ? 'Make one for the family, a partner or housemates, and share receipts, bills and the plan with them.'
            : "When someone invites you to their household, it shows up here. Making one of your own is part of Premium."}
          action={canCreate ? { label: 'Make a household', onPress: () => router.push('/sheets/household-new') } : undefined}
        />
      ) : (
        <Section
          title="Your households"
          footer={canCreate ? undefined : 'Making a household of your own is part of Premium. Joining one is free.'}
        >
          <List inset={52}>
            {list.map((household) => {
              const covered = !!me.data?.entitlements.householdIds.includes(household.id);
              return (
                <Row
                  key={household.id}
                  icon={Users}
                  label={household.name}
                  detail={[
                    household.memberCount === 1 ? '1 member' : `${household.memberCount} members`,
                    household.isAdmin ? 'You own it' : null,
                    covered ? 'Bills and plan shared' : null,
                  ].filter(Boolean).join(' · ')}
                  onPress={() => router.push({ pathname: '/settings/households/[id]', params: { id: household.id } })}
                />
              );
            })}
            {canCreate && <Row icon={Plus} label="Make a household" accent onPress={() => router.push('/sheets/household-new')} />}
          </List>
        </Section>
      )}
    </TabScreen>
  );
}
