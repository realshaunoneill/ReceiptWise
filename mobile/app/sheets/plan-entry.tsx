import React, { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { formatCents } from '@shared/currency';
import { PAYMENT_METHOD_LABEL, PAYMENT_METHOD_OPTIONS, type PaymentMethodOption } from '@shared/labels/plan';
import { fromCents, toCents } from '@shared/money';
import { firstBillDate } from '@shared/plan/new-bill';
import { quickAddLine } from '@shared/plan/parse-lines';
import { confirm } from '../../src/confirm';
import { useCreateBill } from '../../src/hooks/useBills';
import { useCreateEntries, useDeleteEntry, usePlan, useUpdateEntry } from '../../src/hooks/usePlan';
import { defaultBillDay, monthOf, settleDay } from '../../src/plan/days';
import { useScope } from '../../src/scope';
import Button, { success } from '../../src/ui/Button';
import { Field, Segmented } from '../../src/ui/Controls';
import { Chips, DateField, MoneyField, PickerField, SwitchField } from '../../src/ui/Form';
import { Notice } from '../../src/ui/Feedback';
import SheetScreen from '../../src/ui/Sheet';

/**
 * Add a line to the period the way you'd type it into the sheet, a label and an amount, or edit
 * one. "Every month" makes it a recurring bill instead, on a day of the month and paid the way you
 * pick, so it fills itself in from now on (the website's QuickAdd and EntryDialog).
 */
export default function PlanEntry() {
  const { id, offset } = useLocalSearchParams<{ id?: string; offset?: string }>();
  const { householdId } = useScope();
  const plan = usePlan(Number(offset) || 0, householdId).data;
  const line = id ? plan?.lines.find((candidate) => candidate.source === 'entry' && candidate.sourceId === id) : undefined;
  if (!plan) return <SheetScreen title={id ? 'Edit' : 'Add'}>{null}</SheetScreen>;
  if (id && !line) {
    return (
      <SheetScreen title="Edit" closeLabel="Done">
        <Notice tone="neutral" title="This line has gone">It was removed, or moved to another month.</Notice>
      </SheetScreen>
    );
  }
  return line ? <EditEntry plan={plan} line={line} /> : <AddEntry plan={plan} householdId={householdId} offset={offset ?? '0'} />;
}

type Plan = NonNullable<ReturnType<typeof usePlan>['data']>;
type Line = Plan['lines'][number];

function AddEntry({ plan, householdId, offset }: { plan: Plan; householdId?: string; offset: string }) {
  const navigation = useNavigation();
  const router = useRouter();
  const amountRef = useRef<TextInputInstance>(null);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [monthly, setMonthly] = useState(false);
  const [day, setDay] = useState('');
  // Most regular bills are direct debits; one set up with no method went Overdue days after its date.
  const [method, setMethod] = useState<PaymentMethodOption>('direct_debit');
  const [error, setError] = useState<string | null>(null);
  const createEntries = useCreateEntries();
  const createBill = useCreateBill();
  const month = monthOf(plan);

  const add = () => {
    // Only an amount is fine for a one-off ("Extra"); a bill every month needs its name.
    const { label: name, cents, named } = quickAddLine(label, amount);
    if (monthly && !named) return setError('What is the bill?');
    if (cents === null || cents < 0) {
      amountRef.current?.focus();
      return setError('Enter an amount');
    }
    const done = { onSuccess: () => { success(); navigation.goBack(); }, onError: (e: Error) => setError(e.message) };
    if (monthly) {
      const billingDay = day.trim() ? Number(day) : defaultBillDay(plan);
      if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) return setError('Pick a day of the month from 1 to 31');
      createBill.mutate({
        name, amount: fromCents(cents), currency: plan.currency, billingFrequency: 'monthly', billingDay,
        startDate: firstBillDate(plan.period, billingDay), kind: 'bill', paymentMethod: method, householdId: householdId ?? null,
      }, done);
      return;
    }
    createEntries.mutate([{ date: settleDay(plan), label: name, amount: fromCents(cents), householdId: householdId ?? null }], done);
  };

  return (
    <SheetScreen title={`Add to ${month}`} action={{ label: 'Add', onPress: add, loading: createEntries.isPending || createBill.isPending }}>
      <Field label="What it's for" value={label} onChangeText={(text) => { setLabel(text); setError(null); }} placeholder="Birthday present" hint={monthly ? undefined : 'Leave it blank and it\'s added as "Extra".'} maxLength={120} autoFocus returnKeyType="next" onSubmitEditing={() => amountRef.current?.focus()} />
      <MoneyField ref={amountRef} label="Amount" value={amount} onChangeText={(text) => { setAmount(text); setError(null); }} returnKeyType="done" onSubmitEditing={add} />
      <Chips
        label="Your usual items"
        items={plan.suggestions.slice(0, 16).map((suggestion) => {
          const cents = toCents(suggestion.amount);
          return { key: suggestion.label, label: suggestion.label, hint: cents === null ? undefined : `Last time ${formatCents(cents, plan.currency)}` };
        })}
        onPick={(key) => {
          const suggestion = plan.suggestions.find((candidate) => candidate.label === key);
          setLabel(key);
          const cents = toCents(suggestion?.amount ?? null);
          setAmount(cents === null ? '' : fromCents(cents));
          amountRef.current?.focus();
        }}
      />
      <SwitchField label="Every month" detail="A regular bill, so it fills itself in from now on" value={monthly} onChange={setMonthly} />
      {monthly && (
        <>
          <Field label="Day of the month" value={day} onChangeText={setDay} placeholder={String(defaultBillDay(plan))} keyboardType="number-pad" inputMode="numeric" maxLength={2} />
          <PickerField
            label="Paid by"
            value={method}
            options={PAYMENT_METHOD_OPTIONS.map((option) => ({ value: option, label: PAYMENT_METHOD_LABEL[option] }))}
            onChange={setMethod}
            hint={method === 'manual' ? "You tick it off when you pay it; it shows as overdue if you don't." : "Ticked off for you once it's due. You can undo that if it didn't go out."}
          />
        </>
      )}
      {!!error && <Notice tone="bad" title="That didn't work">{error}</Notice>}
      {/* Several at once, copied from a sheet or a note: the paste sheet instead of this one. */}
      {!monthly && (
        <Button label="Paste a list instead" variant="plain" size="sm" onPress={() => router.replace({ pathname: '/sheets/plan-paste', params: { offset } })} style={{ alignSelf: 'flex-start' }} />
      )}
    </SheetScreen>
  );
}

function EditEntry({ plan, line }: { plan: Plan; line: Line }) {
  const navigation = useNavigation();
  const [label, setLabel] = useState(line.label);
  const [amount, setAmount] = useState(fromCents(line.amountCents));
  const [date, setDate] = useState<string | null>(line.date);
  const [direction, setDirection] = useState<'out' | 'in'>(line.direction);
  const [category, setCategory] = useState(line.category ?? '');
  const [notes, setNotes] = useState(line.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const update = useUpdateEntry();
  const remove = useDeleteEntry();

  const save = () => {
    const cents = toCents(amount);
    if (!label.trim()) return setError('What is it for?');
    if (cents === null || cents < 0) return setError('Enter an amount of 0 or more');
    if (!date) return setError('Pick a date');
    update.mutate(
      // A cleared field is sent as null, so it can be emptied.
      { id: line.sourceId, data: { label: label.trim(), amount: fromCents(cents), date, direction, category: category.trim() || null, notes: notes.trim() || null } },
      { onSuccess: () => { success(); navigation.goBack(); }, onError: (e) => setError(e.message) },
    );
  };

  const del = async () => {
    if (!(await confirm(`Remove ${line.label}?`, `It comes out of ${monthOf(plan)}'s plan.`, 'Remove'))) return;
    remove.mutate(line.sourceId, { onSuccess: () => navigation.goBack(), onError: (e) => setError(e.message) });
  };

  return (
    <SheetScreen title={`Edit ${line.label}`} action={{ label: 'Save', onPress: save, loading: update.isPending }}>
      <Field label="What for" value={label} onChangeText={setLabel} maxLength={120} />
      <MoneyField label="Amount" value={amount} onChangeText={setAmount} />
      <DateField label="Date" value={date} onChange={setDate} hint="Its date decides which month it's in." />
      <View style={{ gap: 6 }}>
        <Segmented<'out' | 'in'> accessibilityLabel="Money" value={direction} onChange={setDirection} options={[{ value: 'out', label: 'Going out' }, { value: 'in', label: 'Coming in' }]} />
      </View>
      <Field label="Category" value={category} onChangeText={setCategory} placeholder="Optional" maxLength={50} />
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline />
      {!!error && <Notice tone="bad" title="That didn't work">{error}</Notice>}
      <Button label="Remove" variant="destructive" loading={remove.isPending} onPress={() => void del()} />
    </SheetScreen>
  );
}
