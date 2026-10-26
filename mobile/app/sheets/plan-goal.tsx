import React, { useState } from 'react';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { formatCents } from '@shared/currency';
import { formatLocalDate } from '@shared/dates/local-date';
import { toCents } from '@shared/money';
import { confirm } from '../../src/confirm';
import { useAccounts, useDeleteGoal, useGoals, useSaveGoal } from '../../src/hooks/usePlan';
import { useScope } from '../../src/scope';
import Button, { success } from '../../src/ui/Button';
import { Field } from '../../src/ui/Controls';
import { Notice } from '../../src/ui/Feedback';
import { DateField, MoneyField, PickerField } from '../../src/ui/Form';
import SheetScreen from '../../src/ui/Sheet';
import Text from '../../src/ui/Text';

const TYPED = 'typed';

/**
 * A savings goal: what's put aside each period (a line in the plan), and optionally a target and a
 * date. What's saved is typed in, or read from the savings account it's kept in.
 */
export default function PlanGoal() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { householdId } = useScope();
  const scoped = useGoals(householdId);
  const own = useGoals(undefined);
  const goal = id ? scoped.data?.find((candidate) => candidate.id === id) ?? own.data?.find((candidate) => candidate.id === id) : undefined;
  if (id && !goal) return <SheetScreen title="Edit savings" fullScreen>{null}</SheetScreen>;
  return <GoalForm key={goal?.id ?? 'new'} goal={goal} householdId={householdId} />;
}

type Goal = NonNullable<ReturnType<typeof useGoals>['data']>[number];

function GoalForm({ goal, householdId }: { goal?: Goal; householdId?: string }) {
  const navigation = useNavigation();
  const accounts = useAccounts(householdId);
  const save = useSaveGoal();
  const remove = useDeleteGoal();
  const [name, setName] = useState(goal?.name ?? 'Savings');
  const [perCycle, setPerCycle] = useState(goal?.contributionPerCycle ?? '');
  const [target, setTarget] = useState(goal?.targetAmount ?? '');
  const [targetDate, setTargetDate] = useState<string | null>(goal?.targetDate ?? null);
  const [saved, setSaved] = useState(goal?.savedAmount ?? '');
  const [linked, setLinked] = useState(goal?.linkedAccountId ?? TYPED);
  const [error, setError] = useState<string | null>(null);

  // Savings accounts first: they're where a goal's money usually sits.
  const choices = (accounts.data ?? []).filter((account) => !account.archivedAt).sort((a, b) => Number(b.kind === 'savings') - Number(a.kind === 'savings'));
  const account = choices.find((candidate) => candidate.id === linked);
  const balance = account?.latestBalance ? toCents(account.latestBalance.balance) : null;

  const submit = () => {
    for (const [value, what] of [[perCycle, 'each month'], [target, 'the target'], [saved, 'saved so far']] as const) {
      if (value.trim() && toCents(value) === null) return setError(`Enter ${what} as an amount`);
    }
    save.mutate(
      {
        id: goal?.id,
        data: {
          name: name.trim() || 'Savings',
          contributionPerCycle: perCycle.trim() || null,
          targetAmount: target.trim() || null,
          targetDate,
          savedAmount: saved.trim() || '0',
          linkedAccountId: linked === TYPED ? null : linked,
          ...(goal ? {} : { householdId: householdId ?? null }),
        },
      },
      { onSuccess: () => { success(); navigation.goBack(); }, onError: (e) => setError(e.message) },
    );
  };

  const del = async () => {
    if (!goal || !(await confirm(`Remove ${goal.name}?`, "It comes out of the plan. What's in the account stays there.", 'Remove'))) return;
    remove.mutate(goal.id, { onSuccess: () => navigation.goBack(), onError: (e) => setError(e.message) });
  };

  return (
    <SheetScreen title={goal ? `Edit ${goal.name}` : 'Add savings'} fullScreen action={{ label: 'Save', onPress: submit, loading: save.isPending }}>
      <Text variant="callout" ink="secondary">What you put aside each month shows in the plan. Tick it off when it's moved, and it adds to what's saved.</Text>
      <Field label="Name" value={name} onChangeText={setName} placeholder="House deposit" maxLength={100} />
      <MoneyField label="Each month" value={perCycle} onChangeText={setPerCycle} />
      <MoneyField label="Target (optional)" value={target} onChangeText={setTarget} />
      <DateField label="By (optional)" value={targetDate} onChange={setTargetDate} optional />
      {(choices.length > 0 || linked !== TYPED) && (
        <PickerField
          label="Kept in"
          value={linked}
          options={[
            { value: TYPED, label: "No account: I'll type in what's saved" },
            ...choices.map((candidate) => ({ value: candidate.id, label: candidate.name })),
            ...(linked !== TYPED && !account ? [{ value: linked, label: 'Another account' }] : []),
          ]}
          onChange={setLinked}
        />
      )}
      {linked === TYPED || !account || balance === null ? (
        <MoneyField
          label="Saved so far"
          value={saved}
          onChangeText={setSaved}
          hint={account ? `${account.name} has no balance yet; this is used until it does.` : undefined}
        />
      ) : (
        <Text variant="callout" ink="secondary" tabular>
          {`Saved so far is ${account.name}'s balance, ${formatCents(balance, account.currency)} on ${formatLocalDate(account.latestBalance!.asOfDate, { day: 'numeric', month: 'short' }, 'en-IE')}, plus anything ticked off since.`}
        </Text>
      )}
      {!!error && <Notice tone="bad" title="That didn't work">{error}</Notice>}
      {!!goal && <Button label="Remove" variant="destructive" loading={remove.isPending} onPress={() => void del()} />}
    </SheetScreen>
  );
}
