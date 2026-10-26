import React, { useState } from 'react';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { localToday } from '@shared/dates/local-date';
import { toCents } from '@shared/money';
import { confirm } from '../../src/confirm';
import { useAccounts, useDeleteIncome, useIncome, usePlan, useSaveIncome } from '../../src/hooks/usePlan';
import { useScope } from '../../src/scope';
import Button, { success } from '../../src/ui/Button';
import { Field } from '../../src/ui/Controls';
import { Notice } from '../../src/ui/Feedback';
import { DateField, MoneyField, PickerField, SwitchField } from '../../src/ui/Form';
import SheetScreen from '../../src/ui/Sheet';

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly, on a set day' },
  { value: 'last_working_day', label: 'Monthly, last working day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'fortnightly', label: 'Every two weeks' },
  { value: 'four_weekly', label: 'Every four weeks' },
];
const WEEKEND_RULES = [
  { value: 'previous_business_day', label: 'The working day before' },
  { value: 'next_business_day', label: 'The working day after' },
  { value: 'none', label: 'That day anyway' },
];
const MAIN = 'main';

/** Your pay, and when it lands. The main pay's paydays mark where each period starts. */
export default function PlanIncome() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { householdId } = useScope();
  const scoped = useIncome(householdId);
  const own = useIncome(undefined);
  const plan = usePlan(0, householdId).data;
  const income = id ? scoped.data?.find((candidate) => candidate.id === id) ?? own.data?.find((candidate) => candidate.id === id) : undefined;
  if (id && !income) {
    return <SheetScreen title="Edit income" fullScreen>{(scoped.isError || own.isError) ? <Notice tone="bad" title="Couldn't load it">Pull to refresh the plan and try again.</Notice> : null}</SheetScreen>;
  }
  // The first income is the main one, which sets the periods. Judged by the viewer's own pay in any
  // scope: a household plan only lists what's shared with it.
  const isFirst = income ? income.isPrimary && (plan?.viewerIncomeCount ?? 0) <= 1 : !plan?.primaryIncome;
  return <IncomeForm key={income?.id ?? 'new'} income={income} isFirst={isFirst} currentPrimary={plan?.primaryIncome ?? null} householdId={householdId} />;
}

type Income = NonNullable<ReturnType<typeof useIncome>['data']>[number];

function IncomeForm({ income, isFirst, currentPrimary, householdId }: { income?: Income; isFirst: boolean; currentPrimary: { id: string; name: string } | null; householdId?: string }) {
  const navigation = useNavigation();
  const accounts = useAccounts(householdId);
  const save = useSaveIncome();
  const remove = useDeleteIncome();
  const [name, setName] = useState(income?.name ?? 'Salary');
  const [amount, setAmount] = useState(income?.amount ?? '');
  const [frequency, setFrequency] = useState(income?.frequency ?? 'monthly');
  const [payDay, setPayDay] = useState(String(income?.payDay ?? 25));
  const [anchorDate, setAnchorDate] = useState<string | null>(income?.anchorDate ?? localToday());
  const [weekendRule, setWeekendRule] = useState(income?.weekendRule ?? 'previous_business_day');
  const [isPrimary, setIsPrimary] = useState(income?.isPrimary ?? isFirst);
  const [into, setInto] = useState(income?.intoAccountId ?? MAIN);
  const [error, setError] = useState<string | null>(null);

  const weekly = ['weekly', 'fortnightly', 'four_weekly'].includes(frequency);
  const live = (accounts.data ?? []).filter((account) => !account.archivedAt);
  const replaces = isPrimary && !isFirst && currentPrimary && currentPrimary.id !== income?.id ? currentPrimary : null;

  const submit = () => {
    const day = Number(payDay);
    if (toCents(amount) === null) return setError('Enter the amount');
    if (frequency === 'monthly' && (!Number.isInteger(day) || day < 1 || day > 31)) return setError('Pick a day of the month from 1 to 31');
    if (weekly && !anchorDate) return setError('Pick a day you were paid');
    save.mutate(
      {
        id: income?.id,
        data: {
          name: name.trim() || 'Salary',
          amount: amount.trim(),
          frequency,
          payDay: frequency === 'monthly' ? day : null,
          anchorDate: weekly ? anchorDate : null,
          weekendRule,
          isPrimary,
          intoAccountId: into === MAIN ? null : into,
          ...(income ? {} : { householdId: householdId ?? null }),
        },
      },
      { onSuccess: () => { success(); navigation.goBack(); }, onError: (e) => setError(e.message) },
    );
  };

  const del = async () => {
    if (!income || !(await confirm(`Remove ${income.name}?`, 'It comes out of the plan from now on.', 'Remove'))) return;
    remove.mutate(income.id, { onSuccess: () => navigation.goBack(), onError: (e) => setError(e.message) });
  };

  return (
    <SheetScreen title={income ? 'Edit income' : 'Add your pay'} fullScreen action={{ label: 'Save', onPress: submit, loading: save.isPending, disabled: !amount.trim() }}>
      <Notice tone="neutral" title="What comes in, and when">Your main pay sets the plan: each period runs from one payday to the next.</Notice>
      <Field label="Name" value={name} onChangeText={setName} maxLength={100} />
      <MoneyField label="Amount" value={amount} onChangeText={(text) => { setAmount(text); setError(null); }} autoFocus={!income} />
      <PickerField label="How often" value={frequency} options={FREQUENCIES} onChange={setFrequency} />
      {frequency === 'monthly' && <Field label="Day of the month" value={payDay} onChangeText={setPayDay} keyboardType="number-pad" inputMode="numeric" maxLength={2} />}
      {weekly && <DateField label="A day you were paid" value={anchorDate} onChange={setAnchorDate} />}
      {frequency !== 'last_working_day' && (
        <PickerField label="If payday falls on a weekend or bank holiday, it arrives" value={weekendRule} options={WEEKEND_RULES} onChange={setWeekendRule} />
      )}
      {(live.length > 0 || into !== MAIN) && (
        <PickerField
          label="Paid into"
          value={into}
          options={[
            { value: MAIN, label: 'Your main account' },
            ...live.map((account) => ({ value: account.id, label: account.name })),
            ...(into !== MAIN && !live.some((account) => account.id === into) ? [{ value: into, label: 'Another account' }] : []),
          ]}
          onChange={setInto}
          hint="Used for what's left until payday, when you add balances."
        />
      )}
      {!isFirst && (
        <SwitchField
          label="My main pay"
          detail={replaces ? `This replaces ${replaces.name} as your main pay, and the periods will follow this one's paydays.` : 'It sets the period.'}
          value={isPrimary}
          onChange={setIsPrimary}
        />
      )}
      {!!error && <Notice tone="bad" title="That didn't work">{error}</Notice>}
      {!!income && <Button label="Remove" variant="destructive" loading={remove.isPending} onPress={() => void del()} />}
    </SheetScreen>
  );
}
