import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { type WireBillDetail } from '@shared/api/bills';
import { SUPPORTED_CURRENCIES } from '@shared/currency';
import { localToday } from '@shared/dates/local-date';
import { ESSENTIAL_COPY } from '@shared/labels/plan';
import { categoryOptions, itemNoun } from '@shared/labels/subscriptions';
import { toCents } from '@shared/money';
import { billDay } from '../../src/bills/summary';
import { useBill, useCreateBill, useUpdateBill, type BillInput } from '../../src/hooks/useBills';
import { useHouseholds } from '../../src/hooks/useHouseholds';
import { useMe } from '../../src/hooks/useMe';
import { useAccounts } from '../../src/hooks/usePlan';
import { space } from '../../src/theme';
import { success } from '../../src/ui/Button';
import { Field } from '../../src/ui/Controls';
import { LoadError, Notice, Skeleton } from '../../src/ui/Feedback';
import { DateField, MoneyField, SwitchField } from '../../src/ui/Form';
import InlinePicker, { type PickerGroup } from '../../src/ui/InlinePicker';
import SheetScreen from '../../src/ui/Sheet';
import Text from '../../src/ui/Text';

/** The form as typed: numbers stay strings until saved, '' means not given. */
type Form = {
  name: string;
  description: string;
  category: string;
  amount: string;
  currency: string;
  billingFrequency: string;
  billingDay: string;
  customFrequencyDays: string;
  startDate: string;
  householdId: string | null;
  isBusinessExpense: boolean;
  website: string;
  notes: string;
  kind: 'bill' | 'subscription';
  amountType: 'fixed' | 'variable';
  /** '' = not said */
  paymentMethod: string;
  /** null = the main account */
  paidFromAccountId: string | null;
};

const NONE = '';
const MAIN_ACCOUNT = 'main';
const PERSONAL = 'personal';

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'bimonthly', label: 'Every 2 months' },
  { value: 'quarterly', label: 'Every 3 months' },
  { value: 'six_monthly', label: 'Every 6 months' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Every so many days' },
];

const PAYMENT_METHODS = [
  { value: NONE, label: 'Not sure' },
  { value: 'direct_debit', label: 'Direct debit', detail: 'Assumed paid once it’s collected' },
  { value: 'standing_order', label: 'Standing order', detail: 'Assumed paid once it’s collected' },
  { value: 'card', label: 'On my card', detail: 'Assumed paid once it’s collected' },
  { value: 'manual', label: 'I pay it myself', detail: 'Shows as overdue if you don’t mark it paid' },
];

function formFrom(bill: WireBillDetail): Form {
  return {
    name: bill.name,
    description: bill.description ?? '',
    category: bill.category ?? '',
    amount: bill.amount,
    currency: bill.currency,
    billingFrequency: bill.billingFrequency,
    billingDay: String(bill.billingDay),
    customFrequencyDays: bill.customFrequencyDays ? String(bill.customFrequencyDays) : '',
    startDate: billDay(bill.startDate),
    householdId: bill.householdId,
    isBusinessExpense: !!bill.isBusinessExpense,
    website: bill.website ?? '',
    notes: bill.notes ?? '',
    kind: bill.kind === 'bill' ? 'bill' : 'subscription',
    amountType: bill.amountType === 'variable' ? 'variable' : 'fixed',
    paymentMethod: bill.paymentMethod ?? NONE,
    paidFromAccountId: bill.paidFromAccountId,
  };
}

/**
 * Add or edit a bill or subscription, with the website's fields and checks (its create and edit
 * dialogs and bill-fields.tsx). Editing sends only what changed: sending everything made the
 * server treat a rename as a schedule change and rebuild the payment history.
 */
export default function BillEdit() {
  const { id, kind } = useLocalSearchParams<{ id?: string; kind?: string }>();
  const query = useBill(id);

  if (id && !query.data) {
    return (
      <SheetScreen title="Edit" fullScreen>
        {query.isError ? <LoadError message={query.error.message} onRetry={() => void query.refetch()} /> : (
          <View style={{ gap: space.lg }}>
            <Skeleton height={48} />
            <Skeleton height={48} />
            <Skeleton height={48} />
          </View>
        )}
      </SheetScreen>
    );
  }
  return <BillForm key={id ?? 'new'} bill={query.data} initialKind={kind === 'bill' || kind === 'subscription' ? kind : undefined} />;
}

function BillForm({ bill, initialKind }: { bill?: WireBillDetail; initialKind?: 'bill' | 'subscription' }) {
  const navigation = useNavigation();
  const me = useMe();
  const households = useHouseholds();
  const accounts = useAccounts();
  const create = useCreateBill();
  const update = useUpdateBill(bill?.id ?? '');
  const billsOn = !!me.data?.features.bills;
  const before = bill ? formFrom(bill) : null;
  const [form, setForm] = useState<Form>(() => before ?? {
    name: '',
    description: '',
    category: '',
    amount: '',
    currency: me.data?.currency ?? 'EUR',
    billingFrequency: 'monthly',
    billingDay: '1',
    customFrequencyDays: '',
    // The local day: toISOString's UTC one is yesterday or tomorrow near midnight.
    startDate: localToday(),
    householdId: null,
    isBusinessExpense: false,
    website: '',
    notes: '',
    // Essential by default: most things set up here are bills, and one wrongly left a subscription
    // drops out of the plan's "after bills".
    kind: initialKind ?? 'bill',
    amountType: 'fixed',
    paymentMethod: NONE,
    paidFromAccountId: null,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const noun = itemNoun(form.kind, billsOn);
  const saving = create.isPending || update.isPending;
  const serverError = create.error?.message ?? update.error?.message;
  const once = form.billingFrequency === 'once';

  // Households where it can be shared (someone in them has Premium); one it's already in stays.
  const shareable = (households.data ?? []).filter((h) => me.data?.entitlements.householdIds.includes(h.id) || h.id === form.householdId);
  const householdOptions = [
    { value: PERSONAL, label: 'Just me' },
    ...shareable.map((h) => ({ value: h.id, label: h.name })),
    ...(form.householdId && !shareable.some((h) => h.id === form.householdId) ? [{ value: form.householdId, label: 'Another household' }] : []),
  ];
  // An account that's gone from the list (archived, or someone else's) is kept, not cleared on save.
  const liveAccounts = (accounts.data ?? []).filter((a) => !a.archivedAt);
  const accountOptions = [
    { value: MAIN_ACCOUNT, label: 'Main account' },
    ...liveAccounts.map((a) => ({ value: a.id, label: a.name })),
    ...(form.paidFromAccountId && !liveAccounts.some((a) => a.id === form.paidFromAccountId) ? [{ value: form.paidFromAccountId, label: 'Another account' }] : []),
  ];
  const categoryGroups: PickerGroup<string>[] = [
    { options: [{ value: NONE, label: 'None' }] },
    ...categoryOptions(form.category).map((group) => ({ label: group.label, options: group.categories.map((category) => ({ value: category, label: category })) })),
  ];
  const frequencies = once ? [...FREQUENCIES, { value: 'once', label: 'Once' }] : FREQUENCIES;

  const validate = (): boolean => {
    const next: Partial<Record<keyof Form, string>> = {};
    if (!form.name.trim()) next.name = 'What is it called?';
    const cents = toCents(form.amount);
    if (cents === null || cents <= 0) next.amount = 'Enter an amount over 0';
    const day = Number(form.billingDay);
    if (!once && (!Number.isInteger(day) || day < 1 || day > 31)) next.billingDay = 'A day of the month from 1 to 31';
    const every = Number(form.customFrequencyDays);
    if (form.billingFrequency === 'custom' && (!Number.isInteger(every) || every < 1 || every > 3660)) next.customFrequencyDays = 'How many days between payments?';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.startDate)) next.startDate = 'Pick a date';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const payload = (): Partial<BillInput> => ({
    name: form.name.trim(),
    description: form.description.trim() || null,
    category: form.category || null,
    amount: form.amount.trim(),
    currency: form.currency,
    billingFrequency: form.billingFrequency,
    billingDay: Number(form.billingDay),
    customFrequencyDays: form.billingFrequency === 'custom' ? Number(form.customFrequencyDays) : null,
    startDate: form.startDate,
    householdId: form.householdId,
    isBusinessExpense: form.isBusinessExpense,
    website: form.website.trim() || null,
    notes: form.notes.trim() || null,
    ...(billsOn ? {
      kind: form.kind,
      amountType: form.amountType,
      paymentMethod: form.paymentMethod || null,
      paidFromAccountId: form.paidFromAccountId,
    } : {}),
  });

  const save = () => {
    if (!validate()) return;
    const done = () => {
      success();
      navigation.goBack();
    };
    const data = payload();
    if (!bill || !before) {
      create.mutate(data, { onSuccess: done });
      return;
    }
    // Only what changed.
    const changes: Partial<BillInput> = {};
    if (form.name.trim() !== before.name) changes.name = data.name;
    if (form.description.trim() !== before.description) changes.description = data.description;
    if (form.category !== before.category) changes.category = data.category;
    if (toCents(form.amount) !== toCents(before.amount)) changes.amount = data.amount;
    if (form.currency !== before.currency) changes.currency = data.currency;
    if (form.billingFrequency !== before.billingFrequency) changes.billingFrequency = data.billingFrequency;
    if (form.billingDay !== before.billingDay) changes.billingDay = data.billingDay;
    if (form.billingFrequency === 'custom' && form.customFrequencyDays !== before.customFrequencyDays) changes.customFrequencyDays = data.customFrequencyDays;
    if (form.startDate !== before.startDate) changes.startDate = data.startDate;
    if (form.website.trim() !== before.website) changes.website = data.website;
    if (form.notes.trim() !== before.notes) changes.notes = data.notes;
    if (form.householdId !== before.householdId) changes.householdId = data.householdId;
    if (form.isBusinessExpense !== before.isBusinessExpense) changes.isBusinessExpense = data.isBusinessExpense;
    if (billsOn) {
      if (form.kind !== before.kind) changes.kind = form.kind;
      if (form.amountType !== before.amountType) changes.amountType = form.amountType;
      if (form.paymentMethod !== before.paymentMethod) changes.paymentMethod = form.paymentMethod || null;
      if (form.paidFromAccountId !== before.paidFromAccountId) changes.paidFromAccountId = form.paidFromAccountId;
    }
    if (Object.keys(changes).length === 0) {
      navigation.goBack();
      return;
    }
    update.mutate(changes, { onSuccess: done });
  };

  return (
    <SheetScreen
      title={bill ? `Edit ${noun}` : billsOn ? 'Add a bill or subscription' : 'Add a subscription'}
      fullScreen
      action={{ label: bill ? 'Save' : 'Add', onPress: save, loading: saving }}
    >
      {!bill && <Text variant="callout" ink="secondary">Anything that comes round again: rent, electricity, your phone, Netflix.</Text>}
      {!!serverError && <Notice tone="bad" title={`That ${noun} didn't save`}>{serverError}</Notice>}

      <Field
        label="Name"
        value={form.name}
        onChangeText={(value) => set('name', value)}
        placeholder={billsOn ? 'Rent, Electricity, Netflix' : 'Netflix, Spotify'}
        autoCapitalize="words"
        maxLength={200}
        error={errors.name}
      />
      {billsOn && (
        <SwitchField
          label={ESSENTIAL_COPY.label}
          detail={form.kind === 'bill' ? ESSENTIAL_COPY.on : ESSENTIAL_COPY.off}
          value={form.kind === 'bill'}
          onChange={(essential) => set('kind', essential ? 'bill' : 'subscription')}
        />
      )}
      <InlinePicker label="Category" value={form.category} groups={categoryGroups} onChange={(value) => set('category', value)} placeholder="None" />

      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <MoneyField label={form.amountType === 'variable' ? 'Usual amount' : 'Amount'} value={form.amount} onChangeText={(value) => set('amount', value)} error={errors.amount} />
        </View>
        <View style={{ width: 128 }}>
          <InlinePicker
            label="Currency"
            value={form.currency}
            groups={[{ options: SUPPORTED_CURRENCIES.map((c) => ({ value: c.code, label: `${c.symbol} ${c.code}` })) }]}
            onChange={(value) => set('currency', value)}
          />
        </View>
      </View>
      {billsOn && (
        <SwitchField
          label="The amount changes"
          detail="Electricity, a credit card: enter the usual amount, and set each month's in the plan."
          value={form.amountType === 'variable'}
          onChange={(value) => set('amountType', value ? 'variable' : 'fixed')}
        />
      )}

      <InlinePicker label="How often" value={form.billingFrequency} groups={[{ options: frequencies }]} onChange={(value) => set('billingFrequency', value)} />
      {form.billingFrequency === 'custom' && (
        <Field
          label="Every how many days"
          value={form.customFrequencyDays}
          onChangeText={(value) => set('customFrequencyDays', value.replace(/\D/g, ''))}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="30"
          error={errors.customFrequencyDays}
        />
      )}
      {!once && (
        <Field
          label="Day of the month"
          value={form.billingDay}
          onChangeText={(value) => set('billingDay', value.replace(/\D/g, '').slice(0, 2))}
          keyboardType="number-pad"
          inputMode="numeric"
          hint="A number from 1 to 31"
          error={errors.billingDay}
        />
      )}
      <DateField
        label={bill ? 'Start date' : billsOn ? 'Starting from' : 'When did you start?'}
        value={form.startDate}
        onChange={(day) => day && set('startDate', day)}
        hint={errors.startDate ?? (bill ? 'Changing the start date or schedule rebuilds the expected payments that are still open.' : undefined)}
      />

      {billsOn && (
        <>
          <InlinePicker label="How it's paid" value={form.paymentMethod} groups={[{ options: PAYMENT_METHODS }]} onChange={(value) => set('paymentMethod', value)} />
          {(liveAccounts.length > 0 || !!form.paidFromAccountId) && (
            <InlinePicker
              label="Paid from"
              value={form.paidFromAccountId ?? MAIN_ACCOUNT}
              groups={[{ options: accountOptions }]}
              onChange={(value) => set('paidFromAccountId', value === MAIN_ACCOUNT ? null : value)}
              hint="The plan takes it off this account's balance in “Left until payday”."
            />
          )}
        </>
      )}

      <Text variant="heading" style={{ marginTop: space.sm }}>More details</Text>
      <Field label="Description" value={form.description} onChangeText={(value) => set('description', value)} placeholder="Premium plan, family account" maxLength={1000} />
      {householdOptions.length > 1 && (
        <InlinePicker
          label="Shared with"
          value={form.householdId ?? PERSONAL}
          groups={[{ options: householdOptions }]}
          onChange={(value) => set('householdId', value === PERSONAL ? null : value)}
          hint="Everyone in a household can see it and mark it paid."
        />
      )}
      <SwitchField label="Business expense" detail="A tax-deductible business expense" value={form.isBusinessExpense} onChange={(value) => set('isBusinessExpense', value)} />
      <Field
        label="Website"
        value={form.website}
        onChangeText={(value) => set('website', value)}
        placeholder="https://example.com"
        keyboardType="url"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={500}
      />
      <Field label="Notes" value={form.notes} onChangeText={(value) => set('notes', value)} multiline maxLength={2000} />
    </SheetScreen>
  );
}
