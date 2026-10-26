import React, { useState } from 'react';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useHousehold, useInvite } from '../../src/hooks/useHouseholds';
import { shareInvite } from '../../src/invites';
import { success } from '../../src/ui/Button';
import { Field } from '../../src/ui/Controls';
import SheetScreen from '../../src/ui/Sheet';
import Text from '../../src/ui/Text';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invite someone: an invitation for their email address, then its link, sent however you like
 * from the share sheet. Someone who already has an account on that address also sees it in the
 * app. The link works for 7 days and only once.
 */
export default function InviteToHousehold() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const household = useHousehold(id);
  const invite = useInvite(id);
  const [email, setEmail] = useState('');
  const valid = EMAIL.test(email.trim());

  const send = () => invite.mutate(email.trim(), {
    onSuccess: async (invitation) => {
      success();
      await shareInvite(invitation.householdName ?? household.data?.name ?? 'a household', invitation.inviteUrl).catch(() => undefined);
      navigation.goBack();
    },
  });

  return (
    <SheetScreen title="Invite someone" action={{ label: 'Invite', onPress: send, loading: invite.isPending, disabled: !valid }}>
      <Field
        label="Their email address"
        value={email}
        onChangeText={setEmail}
        placeholder="name@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        autoFocus
        returnKeyType="send"
        onSubmitEditing={() => valid && send()}
        error={invite.error?.message}
      />
      <Text variant="footnote" ink="muted">
        Next, send them the link from the share sheet. It works for 7 days, once. Joining is free; adding receipts of their own needs Premium.
      </Text>
    </SheetScreen>
  );
}
