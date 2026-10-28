import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Plus } from 'lucide-react-native';
import { type WirePlan } from '@shared/api/plan';
import { formatCents } from '@shared/currency';
import { localToday } from '@shared/dates/local-date';
import { planBreakdown } from '@shared/plan/breakdown';
import { BILL_PICKS, billRequests, incomeRequest, payProblem, type BillAnswer, type PayAnswer } from '@shared/plan/setup';
import { invalidateFinanceQueries } from '@shared/query/refresh';
import { api } from '../api/client';
import { useTheme } from '../contexts/ThemeContext';
import { radius, space } from '../theme';
import Button, { selectionTick, success } from '../ui/Button';
import { Field } from '../ui/Controls';
import { Notice } from '../ui/Feedback';
import { DateField, MoneyField, PickerField } from '../ui/Form';
import Text from '../ui/Text';

const FREQUENCIES: Array<{ value: PayAnswer['frequency']; label: string }> = [
  { value: 'monthly', label: 'Monthly, on a set day' },
  { value: 'last_working_day', label: 'Monthly, last working day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'fortnightly', label: 'Every two weeks' },
  { value: 'four_weekly', label: 'Every four weeks' },
];

type Props = {
  currency: string;
  householdId?: string;
  /** After "See my plan", or once skipped. */
  onDone: () => void;
  /** "Skip for now": the plan's "Start with your pay" stays there for later. */
  onSkip: () => void;
};

/**
 * The guided plan setup (shared/plan/setup.ts, as the website's): your pay, your main bills picked
 * from a list, then what's left after them. A minute in, the plan is real, which teaches more than
 * a tour of slides would. The first run and the Plan's "Start with your pay" both open it.
 */
export default function PlanSetup({ currency, householdId, onDone, onSkip }: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'pay' | 'bills' | 'done'>('pay');
  const [pay, setPay] = useState<PayAnswer>({ amount: '', frequency: 'monthly', payDay: 25, anchorDate: localToday() });
  const [payDayText, setPayDayText] = useState('25');
  const [bills, setBills] = useState<Record<string, BillAnswer>>({});
  const [extra, setExtra] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WirePlan | null>(null);

  const planNow = () => {
    const params = new URLSearchParams({ offset: '0', today: localToday() });
    if (householdId) params.set('householdId', householdId);
    return api<WirePlan>(`/api/plan?${params}`);
  };

  const toPay = () => {
    const problem = payProblem(pay);
    if (problem) return setError(problem);
    setError(null);
    setStep('bills');
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api('/api/income', { method: 'POST', json: incomeRequest(pay, currency, householdId ?? null) });
      // The period comes from the pay just added, so the bills land in this month's plan.
      const plan = await planNow();
      for (const body of billRequests(Object.values(bills), plan.period, currency, householdId ?? null)) {
        await api('/api/subscriptions', { method: 'POST', json: body });
      }
      await invalidateFinanceQueries(queryClient);
      setResult(await planNow());
      success();
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: string, label: string) => {
    selectionTick();
    setBills((current) => {
      const next = { ...current };
      if (next[key]) delete next[key];
      else next[key] = { key, label, amount: '' };
      return next;
    });
  };

  if (step === 'done' && result) {
    const breakdown = planBreakdown(result.lines);
    const money = (cents: number) => formatCents(Math.abs(cents), result.currency);
    return (
      <View style={{ gap: space.lg }}>
        <Text variant="largeTitle" accessibilityRole="header">Your plan is ready</Text>
        <View style={{ gap: space.xs }}>
          <Text variant="footnote" ink="muted">After bills this month</Text>
          <Text variant="largeTitle" tabular ink={breakdown.afterBillsCents < 0 ? 'bad' : 'primary'}>{money(breakdown.afterBillsCents)}</Text>
          <Text variant="callout" ink="secondary" tabular>{`${money(breakdown.leftCents)} left once everything's out · ${formatCents(result.totals.weeklyCents, result.currency)} a week`}</Text>
        </View>
        <Text variant="callout" ink="secondary">Add savings, one-offs and the rest from the plan's + button. A bill different this month? Tap its amount.</Text>
        <Button label="See my plan" onPress={onDone} />
      </View>
    );
  }

  if (step === 'bills') {
    const picked = Object.values(bills);
    return (
      <View style={{ gap: space.lg }}>
        <Text variant="largeTitle" accessibilityRole="header">Your main bills</Text>
        <Text variant="body" ink="secondary">Tap the ones you pay and put in roughly how much. You can change any of them later.</Text>
        <View style={{ gap: space.sm }}>
          {[...BILL_PICKS.map((pick) => ({ key: pick.key, label: pick.label })), ...picked.filter((bill) => bill.key.startsWith('own:'))].map((pick) => {
            const chosen = bills[pick.key];
            return (
              <View key={pick.key} style={{ gap: space.sm }}>
                <Pick label={pick.label} chosen={!!chosen} onPress={() => toggle(pick.key, pick.label)} />
                {!!chosen && (
                  <MoneyField
                    label={`${pick.label}, roughly`}
                    value={chosen.amount}
                    onChangeText={(amount) => setBills((current) => ({ ...current, [pick.key]: { ...chosen, amount } }))}
                    autoFocus
                  />
                )}
              </View>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label="Something else" value={extra} onChangeText={setExtra} placeholder="Bin collection" maxLength={100} />
          </View>
          <Button
            label="Add"
            icon={Plus}
            variant="secondary"
            disabled={!extra.trim()}
            onPress={() => {
              const key = `own:${extra.trim().toLowerCase()}`;
              setBills((current) => ({ ...current, [key]: { key, label: extra.trim(), amount: '' } }));
              setExtra('');
            }}
          />
        </View>
        {!!error && <Notice tone="bad" title="That didn't save">{error}</Notice>}
        <Button label={picked.length ? 'Save my plan' : 'Save, with no bills yet'} loading={saving} onPress={() => void save()} />
        <Button label="Back" variant="plain" onPress={() => setStep('pay')} style={{ alignSelf: 'center' }} />
      </View>
    );
  }

  const weekly = ['weekly', 'fortnightly', 'four_weekly'].includes(pay.frequency);
  return (
    <View style={{ gap: space.lg }}>
      <Text variant="largeTitle" accessibilityRole="header">Your pay</Text>
      <Text variant="body" ink="secondary">The plan runs from one payday to the next, so it starts with what comes in and when.</Text>
      <MoneyField label="What you get paid, after tax" value={pay.amount} onChangeText={(amount) => setPay({ ...pay, amount })} />
      <PickerField label="How often" value={pay.frequency} options={FREQUENCIES} onChange={(frequency) => setPay({ ...pay, frequency })} />
      {pay.frequency === 'monthly' && (
        <Field
          label="Payday"
          hint="The day of the month. A weekend or bank holiday moves it to the working day before."
          value={payDayText}
          onChangeText={(text) => {
            setPayDayText(text);
            setPay({ ...pay, payDay: Number(text) || null });
          }}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={2}
        />
      )}
      {weekly && <DateField label="A day you were paid" value={pay.anchorDate ?? null} onChange={(anchorDate) => setPay({ ...pay, anchorDate })} />}
      {!!error && <Notice tone="bad" title="Not yet">{error}</Notice>}
      <Button label="Continue" onPress={toPay} />
      <Button label="Skip for now" variant="plain" onPress={onSkip} style={{ alignSelf: 'center' }} />
    </View>
  );
}

function Pick({ label, chosen, onPress }: { label: string; chosen: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      aria-checked={chosen}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.lg, borderRadius: radius.lg,
        borderWidth: 1, borderColor: chosen ? colors.accent : colors.border, backgroundColor: pressed ? colors.cardPressed : chosen ? colors.accentSoft : colors.card,
      })}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: chosen ? 0 : 2, borderColor: colors.textMuted, backgroundColor: chosen ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {chosen && <Check size={14} color={colors.onAccent} strokeWidth={3} />}
      </View>
      <Text variant="callout" weight={chosen ? 'semibold' : 'regular'}>{label}</Text>
    </Pressable>
  );
}
