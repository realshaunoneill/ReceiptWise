import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Check } from 'lucide-react-native';
import { formatCents } from '@shared/currency';
import { PAYMENT_METHOD_LABEL, PAYMENT_METHOD_OPTIONS, type PaymentMethodOption } from '@shared/labels/plan';
import { fromCents, toCents } from '@shared/money';
import { firstBillDate } from '@shared/plan/new-bill';
import { parseLines } from '@shared/plan/parse-lines';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useCreateBill } from '../../src/hooks/useBills';
import { useCreateEntries, usePlan } from '../../src/hooks/usePlan';
import { defaultBillDay, monthOf, settleDay } from '../../src/plan/days';
import { useScope } from '../../src/scope';
import { space } from '../../src/theme';
import Button, { selectionTick, success } from '../../src/ui/Button';
import { Field } from '../../src/ui/Controls';
import { Notice } from '../../src/ui/Feedback';
import { ListField, PickerField } from '../../src/ui/Form';
import { List } from '../../src/ui/Section';
import SheetScreen from '../../src/ui/Sheet';
import Text from '../../src/ui/Text';

/**
 * Many lines at once: typed, or the label and amount columns copied out of a spreadsheet (one tab
 * per month, as Megan keeps hers). Each can be marked monthly, which makes it a regular bill. A
 * line named like a bill already in the period starts unticked: a pasted sheet repeats the rent.
 */
export default function PlanPaste() {
  const { offset } = useLocalSearchParams<{ offset?: string }>();
  const navigation = useNavigation();
  const { householdId } = useScope();
  const plan = usePlan(Number(offset) || 0, householdId).data;
  const [text, setText] = useState('');
  // Lines whose tick was changed from the default (on, or off for one that's already a bill).
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [monthly, setMonthly] = useState<Set<number>>(new Set());
  const [day, setDay] = useState('');
  const [method, setMethod] = useState<PaymentMethodOption>('direct_debit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createEntries = useCreateEntries();
  const createBill = useCreateBill();

  const parsed = useMemo(() => parseLines(text), [text]);
  const bills = useMemo(() => new Set((plan?.lines ?? []).filter((line) => line.source === 'recurring').map((line) => line.label.trim().toLowerCase())), [plan]);
  if (!plan) return <SheetScreen title="Paste a list">{null}</SheetScreen>;

  const lines = parsed
    .map((line, index) => ({ ...line, index, cents: line.amount === null ? null : toCents(line.amount), isBill: bills.has(line.label.trim().toLowerCase()) }))
    .filter((line) => line.cents !== null && line.cents > 0);
  const isChosen = (line: { index: number; isBill: boolean }) => line.isBill === flipped.has(line.index);
  const chosen = lines.filter(isChosen);
  const left = parsed.length - lines.length;
  const anyMonthly = chosen.some((line) => monthly.has(line.index));
  const month = monthOf(plan);
  const flip = (set: Set<number>, index: number, apply: (next: Set<number>) => void) => {
    selectionTick();
    const next = new Set(set);
    if (next.has(index)) next.delete(index); else next.add(index);
    apply(next);
  };

  const save = async () => {
    if (chosen.length === 0) return;
    const billingDay = day.trim() ? Number(day) : defaultBillDay(plan);
    if (anyMonthly && (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31)) return setError('Pick a day of the month from 1 to 31');
    setSaving(true);
    setError(null);
    try {
      const oneOffs = chosen.filter((line) => !monthly.has(line.index));
      const newBills = chosen.filter((line) => monthly.has(line.index));
      if (oneOffs.length > 0) {
        await createEntries.mutateAsync(oneOffs.map((line) => ({ date: settleDay(plan), label: line.label, amount: fromCents(line.cents!), householdId: householdId ?? null })));
      }
      for (const line of newBills) {
        await createBill.mutateAsync({
          name: line.label, amount: fromCents(line.cents!), currency: plan.currency, billingFrequency: 'monthly', billingDay,
          startDate: firstBillDate(plan.period, billingDay), kind: 'bill', paymentMethod: method, householdId: householdId ?? null,
        });
      }
      success();
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add them");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SheetScreen title={`Paste into ${month}`} action={{ label: chosen.length ? `Add ${chosen.length}` : 'Add', onPress: () => void save(), loading: saving, disabled: chosen.length === 0 }}>
      <ListField
        label="One per line"
        value={text}
        onChangeText={(next) => {
          setText(next);
          setFlipped(new Set());
          setMonthly(new Set());
        }}
        placeholder={'Rent 150\nCar 469\nBirthday present 40'}
      />
      <Button
        label="Paste from the clipboard"
        variant="secondary"
        size="sm"
        onPress={async () => {
          const pasted = await Clipboard.getStringAsync();
          if (pasted) setText(pasted);
        }}
        style={{ alignSelf: 'flex-start' }}
      />
      {lines.length > 0 && (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.xs }}>
            <Text variant="footnote" ink="muted">Add</Text>
            <Text variant="footnote" ink="muted">Every month</Text>
          </View>
          <List inset={56}>
            {lines.map((line) => (
              <View key={line.index} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingRight: space.sm }}>
                <Tick checked={isChosen(line)} label={`Add ${line.label}`} onPress={() => flip(flipped, line.index, setFlipped)} />
                <View style={{ flex: 1 }}>
                  <Text variant="callout" ink={isChosen(line) ? 'primary' : 'muted'} numberOfLines={1}>{line.label}</Text>
                  {line.isBill && <Text variant="footnote" ink="muted">{`Already a bill in ${month}`}</Text>}
                </View>
                <Text variant="callout" tabular>{formatCents(line.cents!, plan.currency)}</Text>
                <Tick checked={monthly.has(line.index)} disabled={!isChosen(line)} label={`${line.label} every month`} onPress={() => flip(monthly, line.index, setMonthly)} />
              </View>
            ))}
          </List>
        </View>
      )}
      {anyMonthly && (
        <>
          <Field label="Day of the month" value={day} onChangeText={setDay} placeholder={String(defaultBillDay(plan))} keyboardType="number-pad" inputMode="numeric" maxLength={2} />
          <PickerField label="Monthly ones paid by" value={method} options={PAYMENT_METHOD_OPTIONS.map((option) => ({ value: option, label: PAYMENT_METHOD_LABEL[option] }))} onChange={setMethod} />
        </>
      )}
      {left > 0 && <Text variant="footnote" ink="muted">{left === 1 ? '1 line with no amount left out.' : `${left} lines with no amount left out.`}</Text>}
      {!!error && <Notice tone="bad" title="That didn't work">{error}</Notice>}
    </SheetScreen>
  );
}

function Tick({ checked, disabled, label, onPress }: { checked: boolean; disabled?: boolean; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="checkbox" aria-checked={checked} aria-disabled={!!disabled} accessibilityLabel={label} style={{ width: 52, height: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: checked ? 0 : 2, borderColor: colors.textMuted, backgroundColor: checked ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {checked && <Check size={15} color={colors.onAccent} strokeWidth={3} />}
      </View>
    </Pressable>
  );
}
