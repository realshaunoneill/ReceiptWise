import React, { useState } from 'react';
import { useNavigation, useRouter } from 'expo-router';
import { useCreateHousehold } from '../../src/hooks/useHouseholds';
import { success } from '../../src/ui/Button';
import { Field } from '../../src/ui/Controls';
import SheetScreen from '../../src/ui/Sheet';
import Text from '../../src/ui/Text';

/** Make a household; you're its owner, and invite people from it next. */
export default function NewHousehold() {
  const navigation = useNavigation();
  const router = useRouter();
  const create = useCreateHousehold();
  const [name, setName] = useState('');

  const save = () => create.mutate(name.trim(), {
    onSuccess: (household) => {
      success();
      navigation.goBack();
      router.push({ pathname: '/settings/households/[id]', params: { id: household.id } });
    },
  });

  return (
    <SheetScreen title="New household" action={{ label: 'Make', onPress: save, loading: create.isPending, disabled: !name.trim() }}>
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="The house, the family, the flat"
        autoFocus
        maxLength={100}
        returnKeyType="done"
        onSubmitEditing={() => name.trim() && save()}
        error={create.error?.message}
      />
      <Text variant="footnote" ink="muted">Once it's made, invite people with a link. Everyone in it sees the receipts, bills and plan shared with it.</Text>
    </SheetScreen>
  );
}
