import React, { useState } from 'react';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useHousehold, useRenameHousehold } from '../../src/hooks/useHouseholds';
import { success } from '../../src/ui/Button';
import { Field } from '../../src/ui/Controls';
import SheetScreen from '../../src/ui/Sheet';

/** Rename a household (its owner only). */
export default function RenameHousehold() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const household = useHousehold(id);
  const rename = useRenameHousehold(id);
  const [name, setName] = useState(household.data?.name ?? '');
  const unchanged = !name.trim() || name.trim() === household.data?.name;

  const save = () => rename.mutate(name.trim(), {
    onSuccess: () => {
      success();
      navigation.goBack();
    },
  });

  return (
    <SheetScreen title="Rename" action={{ label: 'Save', onPress: save, loading: rename.isPending, disabled: unchanged }}>
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        autoFocus
        maxLength={100}
        returnKeyType="done"
        onSubmitEditing={() => !unchanged && save()}
        error={rename.error?.message}
      />
    </SheetScreen>
  );
}
