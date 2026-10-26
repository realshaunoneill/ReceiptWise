import React, { useState } from 'react';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { formatCents } from '@shared/currency';
import { fromCents, toCents } from '@shared/money';
import { useUpdateEntry, useUpdateOccurrence } from '../../src/hooks/usePlan';
import { success } from '../../src/ui/Button';
import { MoneyField } from '../../src/ui/Form';
import SheetScreen from '../../src/ui/Sheet';
import Text from '../../src/ui/Text';

type Params = {
  /** 'occurrence': a bill's cycle (id is the bill, with cycleDate); 'entry': a one-off line. */
  kind: 'occurrence' | 'entry';
  id: string;
  cycleDate?: string;
  /** '1' when the occurrence is paid: then it's what was paid that changes. */
  paid?: string;
  label: string;
  cents: string;
  currency: string;
};

/** A line's amount, for this period only: the bill's usual amount and other months stay as they are. */
export default function PlanAmount() {
  const params = useLocalSearchParams<Params>();
  const navigation = useNavigation();
  const [value, setValue] = useState(fromCents(Number(params.cents) || 0));
  const [error, setError] = useState<string | null>(null);
  const occurrence = useUpdateOccurrence(params.id);
  const entry = useUpdateEntry();
  const saving = occurrence.isPending || entry.isPending;
  const paid = params.paid === '1';

  const save = () => {
    const cents = toCents(value);
    if (cents === null || cents < 0) {
      setError('Enter an amount of 0 or more');
      return;
    }
    if (cents === Number(params.cents)) {
      navigation.goBack();
      return;
    }
    const amount = fromCents(cents);
    const done = { onSuccess: () => { success(); navigation.goBack(); }, onError: (e: Error) => setError(e.message) };
    if (params.kind === 'occurrence') {
      occurrence.mutate({ expectedDate: params.cycleDate!, data: paid ? { actualAmount: amount } : { expectedAmount: amount } }, done);
    } else {
      entry.mutate({ id: params.id, data: { amount } }, done);
    }
  };

  return (
    <SheetScreen title={params.label} action={{ label: 'Save', onPress: save, loading: saving }}>
      <MoneyField
        label={paid ? 'What was paid' : params.kind === 'occurrence' ? 'Amount this time' : 'Amount'}
        value={value}
        onChangeText={(text) => {
          setValue(text);
          setError(null);
        }}
        autoFocus
        selectTextOnFocus
        onSubmitEditing={save}
        returnKeyType="done"
        error={error}
        hint={params.kind === 'occurrence' ? 'Only for this period: the bill keeps its usual amount.' : undefined}
      />
      <Text variant="footnote" ink="muted" tabular>{`Was ${formatCents(Number(params.cents) || 0, params.currency)}`}</Text>
    </SheetScreen>
  );
}
