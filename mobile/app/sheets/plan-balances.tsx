import React, { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { formatCents } from '@shared/currency';
import { formatLocalDate, localToday } from '@shared/dates/local-date';
import { ACCOUNT_KIND_LABEL } from '@shared/labels/plan';
import { toCents } from '@shared/money';
import { changedBalances } from '@shared/plan/balances';
import { confirm } from '../../src/confirm';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAccounts, useArchiveAccount, useRecordBalances, useSaveAccount } from '../../src/hooks/usePlan';
import { useScope } from '../../src/scope';
import { radius, space } from '../../src/theme';
import Button, { success } from '../../src/ui/Button';
import { Field } from '../../src/ui/Controls';
import { Notice } from '../../src/ui/Feedback';
import { MoneyField, PickerField, SwitchField } from '../../src/ui/Form';
import { Card, Section } from '../../src/ui/Section';
import SheetScreen from '../../src/ui/Sheet';
import Text, { FONT } from '../../src/ui/Text';

type Kind = 'current' | 'savings' | 'cash';
type Edit = { name: string; kind: Kind; includeInPlan: boolean };
const asKind = (kind: string): Kind => (kind === 'savings' || kind === 'cash' ? kind : 'current');
const KINDS = Object.entries(ACCOUNT_KIND_LABEL).map(([value, label]) => ({ value: value as Kind, label }));

/**
 * Today's balances, typed in from the banking app (there's no bank connection): only the ones
 * changed are recorded, so an untouched account keeps its date and its "over a week old" warning.
 * Also where accounts are added, renamed, counted or not, and archived.
 */
export default function PlanBalances() {
  const { currency = 'EUR' } = useLocalSearchParams<{ currency?: string }>();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { householdId } = useScope();
  const accounts = useAccounts(householdId);
  const record = useRecordBalances();
  const saveAccount = useSaveAccount();
  const archive = useArchiveAccount();
  const [values, setValues] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [newKind, setNewKind] = useState<Kind>('current');
  const [newCounted, setNewCounted] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = accounts.data ?? [];

  // Fill in what's known, and keep what's been typed when the list refetches (one archived).
  useEffect(() => {
    if (!accounts.data) return;
    setValues((typed) => Object.fromEntries(accounts.data.map((account) => [account.id, typed[account.id] ?? account.latestBalance?.balance ?? ''])));
    setEdits((typed) => Object.fromEntries(accounts.data.map((account) => [account.id, typed[account.id] ?? { name: account.name, kind: asKind(account.kind), includeInPlan: account.includeInPlan }])));
    setNewName((typed) => typed || (accounts.data.length === 0 ? 'Current account' : ''));
  }, [accounts.data]);

  const edit = (id: string, change: Partial<Edit>) => setEdits((all) => ({ ...all, [id]: { ...all[id], ...change } }));

  const save = async () => {
    setSaving(true);
    setError(null);
    const today = localToday();
    try {
      const balances = changedBalances(list, values, today);
      if (balances.length > 0) await record.mutateAsync(balances);
      for (const account of list) {
        const change = edits[account.id];
        if (!change) continue;
        const data: Partial<Edit> = {};
        if (change.name.trim() && change.name.trim() !== account.name) data.name = change.name.trim();
        if (change.kind !== account.kind) data.kind = change.kind;
        if (change.includeInPlan !== account.includeInPlan) data.includeInPlan = change.includeInPlan;
        if (Object.keys(data).length > 0) await saveAccount.mutateAsync({ id: account.id, data });
      }
      if (newName.trim() && newBalance.trim()) {
        if (toCents(newBalance) === null) throw new Error('Enter the balance as a number');
        await saveAccount.mutateAsync({ data: { name: newName.trim(), kind: newKind, includeInPlan: newCounted, balance: newBalance.trim(), asOfDate: today, householdId: householdId ?? null } });
      }
      success();
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the balances");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetScreen title="Today's balances" fullScreen action={{ label: 'Save', onPress: () => void save(), loading: saving }}>
      <Text variant="callout" ink="secondary">Type in what your banking app shows now. Only the ones you change are updated. Accounts that aren't counted (savings, usually) are left out of what's left to spend.</Text>

      {list.length > 0 && (
        <Section style={{ marginHorizontal: 0, marginBottom: 0 }}>
          <Card>
            {list.map((account, index) => (editing ? (
              <View key={account.id} style={{ padding: space.lg, gap: space.md, borderTopWidth: index ? 1 : 0, borderColor: colors.separator }}>
                <Field label="Name" value={edits[account.id]?.name ?? account.name} onChangeText={(name) => edit(account.id, { name })} maxLength={100} />
                <PickerField label="Kind" value={edits[account.id]?.kind ?? asKind(account.kind)} options={KINDS} onChange={(kind) => edit(account.id, { kind })} />
                <SwitchField label="Count it in what's left" value={edits[account.id]?.includeInPlan ?? account.includeInPlan} onChange={(includeInPlan) => edit(account.id, { includeInPlan })} />
                <Button
                  label="Archive"
                  variant="destructive"
                  size="sm"
                  loading={archive.isPending && archive.variables === account.id}
                  onPress={async () => {
                    if (await confirm(`Archive ${account.name}?`, "It's no longer counted or shown. Its history is kept.", 'Archive')) archive.mutate(account.id, { onError: (e) => setError(e.message) });
                  }}
                  style={{ alignSelf: 'flex-start' }}
                />
              </View>
            ) : (
              <View key={account.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: index ? 1 : 0, borderColor: colors.separator }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="callout" weight="medium">{account.name}</Text>
                  <Text variant="footnote" ink="muted">
                    {[
                      ACCOUNT_KIND_LABEL[account.kind] ?? account.kind,
                      !account.includeInPlan && 'not counted',
                      account.latestBalance && `as of ${formatLocalDate(account.latestBalance.asOfDate, { day: 'numeric', month: 'short' }, 'en-IE')}`,
                    ].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <TextInput
                  value={values[account.id] ?? ''}
                  onChangeText={(text) => setValues((all) => ({ ...all, [account.id]: text }))}
                  keyboardType="numbers-and-punctuation"
                  inputMode="decimal"
                  placeholder={formatCents(0, currency)}
                  placeholderTextColor={colors.textMuted}
                  selectTextOnFocus
                  accessibilityLabel={`${account.name} balance`}
                  style={{ width: 130, textAlign: 'right', backgroundColor: colors.field, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 10, fontFamily: FONT.medium, fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] }}
                />
              </View>
            )))}
          </Card>
          <Button label={editing ? 'Back to balances' : 'Rename, change or archive accounts'} variant="plain" size="sm" onPress={() => setEditing(!editing)} style={{ alignSelf: 'flex-start', marginTop: space.sm }} />
        </Section>
      )}

      {!editing && (
        <>
          <Text variant="heading" accessibilityRole="header">{list.length ? 'Add another account' : 'Your account'}</Text>
          <Field label="Name" value={newName} onChangeText={setNewName} placeholder="Current account" maxLength={100} />
          <MoneyField label="Balance today" value={newBalance} onChangeText={setNewBalance} keyboardType="numbers-and-punctuation" />
          {!!newName.trim() && (
            <>
              <PickerField
                label="Kind"
                value={newKind}
                options={KINDS}
                onChange={(kind) => {
                  setNewKind(kind);
                  // A savings account isn't spending money: off by default, as the API does.
                  setNewCounted(kind !== 'savings');
                }}
              />
              <SwitchField label="Count it in what's left" value={newCounted} onChange={setNewCounted} />
            </>
          )}
        </>
      )}
      {!!error && <Notice tone="bad" title="That didn't work">{error}</Notice>}
    </SheetScreen>
  );
}
