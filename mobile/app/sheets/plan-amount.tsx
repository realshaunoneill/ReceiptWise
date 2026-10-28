import React, { useState } from 'react';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { formatCents } from '@shared/currency';
import { fromCents, toCents } from '@shared/money';
import { useSetPlanAmount, useUpdateEntry, useUpdateOccurrence } from '../../src/hooks/usePlan';
import Button, { success } from '../../src/ui/Button';
import { MoneyField } from '../../src/ui/Form';
import SheetScreen from '../../src/ui/Sheet';
import Text from '../../src/ui/Text';

type Params = {
  /**
   * 'occurrence': a bill's cycle (id is the bill, with cycleDate); 'entry': a one-off line;
   * 'income' and 'goal': this payday's pay or this period's savings (id, with day).
   */
  kind: 'occurrence' | 'entry' | 'income' | 'goal';
  id: string;
  cycleDate?: string;
  /** The payday (income) or the period's first day (goal) the amount is for. */
  day?: string;
  /** Pay or savings already changed for this month: the usual amount, in cents. */
  usual?: string;
  /** '1' when the occurrence is paid: then it's what was paid that changes. */
  paid?: string;
  /** The month, for "only for November". */
  month?: string;
  label: string;
  cents: string;
  currency: string;
};

const HINT: Record<Params['kind'], (month: string) => string | undefined> = {
  occurrence: () => 'Only for this period: the bill keeps its usual amount.',
  entry: () => undefined,
  income: (month) => `Only for ${month}: other months keep your usual pay.`,
  goal: (month) => `Only for ${month}: other months keep the usual amount. 0 skips it this month.`,
};

/** A line's amount, for this period only: the usual amount and other months stay as they are. */
export default function PlanAmount() {
  const params = useLocalSearchParams<Params>();
  const navigation = useNavigation();
  const [value, setValue] = useState(fromCents(Number(params.cents) || 0));
  const [error, setError] = useState<string | null>(null);
  const occurrence = useUpdateOccurrence(params.id);
  const entry = useUpdateEntry();
  const planAmount = useSetPlanAmount();
  const saving = occurrence.isPending || entry.isPending || planAmount.isPending;
  const paid = params.paid === '1';
  const month = params.month || 'this month';
  const usualCents = params.usual ? Number(params.usual) : null;
  const done = { onSuccess: () => { success(); navigation.goBack(); }, onError: (e: Error) => setError(e.message) };

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
    if (params.kind === 'occurrence') {
      occurrence.mutate({ expectedDate: params.cycleDate!, data: paid ? { actualAmount: amount } : { expectedAmount: amount } }, done);
    } else if (params.kind === 'entry') {
      entry.mutate({ id: params.id, data: { amount } }, done);
    } else {
      // Typing the usual amount back in is the same as going back to it.
      planAmount.mutate({ source: params.kind, sourceId: params.id, day: params.day!, amount: cents === usualCents ? null : amount }, done);
    }
  };

  const label = paid ? 'What was paid'
    : params.kind === 'occurrence' ? 'Amount this time'
      : params.kind === 'income' ? `Pay for ${month}`
        : params.kind === 'goal' ? `Put aside in ${month}`
          : 'Amount';

  return (
    <SheetScreen title={params.label} action={{ label: 'Save', onPress: save, loading: saving }}>
      <MoneyField
        label={label}
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
        hint={HINT[params.kind](month)}
      />
      <Text variant="footnote" ink="muted" tabular>
        {usualCents !== null
          ? `Usually ${formatCents(usualCents, params.currency)}`
          : `Was ${formatCents(Number(params.cents) || 0, params.currency)}`}
      </Text>
      {usualCents !== null && (
        <Button
          label={`Back to the usual ${formatCents(usualCents, params.currency)}`}
          variant="secondary"
          disabled={saving}
          onPress={() => planAmount.mutate({ source: params.kind as 'income' | 'goal', sourceId: params.id, day: params.day!, amount: null }, done)}
        />
      )}
    </SheetScreen>
  );
}
