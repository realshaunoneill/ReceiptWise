import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { CalendarClock, ChevronLeft, ChevronRight, ClipboardPaste, PiggyBank, Plus, Receipt, Users, Wallet } from 'lucide-react-native';
import { formatCents } from '@shared/currency';
import { type WirePlan } from '@shared/api/plan';
import { addDays } from '@shared/dates/local-date';
import { planBreakdown } from '@shared/plan/breakdown';
import { planNotes } from '@shared/plan/plan-notes';
import { scopePickerPlacement } from '../../../src/components/ScopePicker';
import { choose } from '../../../src/confirm';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { useHouseholds } from '../../../src/hooks/useHouseholds';
import { useMe } from '../../../src/hooks/useMe';
import { usePlan, useSaveIncome } from '../../../src/hooks/usePlan';
import BankCheck from '../../../src/plan/BankCheck';
import BillInbox from '../../../src/plan/BillInbox';
import { monthOf, shortDay } from '../../../src/plan/days';
import PlanLines from '../../../src/plan/PlanLines';
import { useScope } from '../../../src/scope';
import { GUTTER, radius, space } from '../../../src/theme';
import Button, { selectionTick, success } from '../../../src/ui/Button';
import { LoadError, Notice, Skeleton } from '../../../src/ui/Feedback';
import HeaderButton from '../../../src/ui/HeaderButton';
import Row from '../../../src/ui/Row';
import { Card, List, Section } from '../../../src/ui/Section';
import Stale from '../../../src/ui/Stale';
import TabScreen from '../../../src/ui/TabScreen';
import Text from '../../../src/ui/Text';

const INTRO_KEY = 'receiptwise_plan_intro_seen';

/** The month, payday to payday: what comes in, what goes out, and what's left. */
export default function Plan() {
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const me = useMe();
  const { householdId } = useScope();
  const plan = usePlan(offset, householdId);
  // The month after, for the "Plan December" row (and so stepping forward is instant).
  const next = usePlan(offset + 1, householdId);
  const households = useHouseholds();
  const householdNames = Object.fromEntries((households.data ?? []).map((household) => [household.id, household.name]));

  if (me.data && !me.data.subscribed && me.data.entitlements.householdIds.length === 0) {
    return (
      <TabScreen>
        <Section>
          <Notice tone="neutral" title="The plan is part of Premium">
            It lays out your month from payday to payday: what's coming in, the bills on the way, and what's left.
          </Notice>
        </Section>
      </TabScreen>
    );
  }

  const data = plan.data;
  // Another household's plan or another month on its way: the last one stays, dimmed.
  const switching = plan.isPlaceholderData;
  const scope = scopePickerPlacement(switching);
  const params = { offset: String(offset) };
  const add = async () => {
    if (!data) return;
    const options = [
      { label: `Add to ${monthOf(data)}`, run: () => router.push({ pathname: '/sheets/plan-entry', params }) },
      { label: 'Paste a list', run: () => router.push({ pathname: '/sheets/plan-paste', params }) },
      { label: 'Bring in a bill', run: () => router.push({ pathname: '/capture', params: { mode: 'bill' } }) },
      { label: data.viewerIncomeCount === 0 ? 'Add your pay' : 'Add income', run: () => router.push('/sheets/plan-income') },
      { label: 'Add savings', run: () => router.push('/sheets/plan-goal') },
      ...(data.daysLeft !== null ? [{ label: "Update today's balances", run: () => router.push({ pathname: '/sheets/plan-balances', params: { currency: data.currency } }) }] : []),
    ];
    const index = await choose('Add', options.map((option) => ({ label: option.label })));
    if (index !== null) options[index].run();
  };

  return (
    <>
      <Stack.Screen options={{ headerLeft: scope.headerLeft, headerRight: () => <HeaderButton icon={Plus} label="Add to the plan" onPress={() => void add()} /> }} />
      <TabScreen onRefresh={() => void plan.refetch()} refreshing={plan.isRefetching && !switching}>
        {scope.inline}
        <PeriodSwitcher plan={data} offset={offset} onChange={setOffset} loading={switching} />
        {plan.isError && !data ? (
          <LoadError message={plan.error.message} onRetry={() => void plan.refetch()} />
        ) : !data ? (
          <View style={{ marginHorizontal: GUTTER, gap: space.lg }}>
            <Skeleton height={140} round={radius.lg} />
            <Skeleton height={220} round={radius.lg} />
          </View>
        ) : (
          <Stale stale={switching}>
            <StartHere plan={data} householdNames={householdNames} />
            <HowItWorks />
            <Summary plan={data} />
            <NextMonth plan={next.isPlaceholderData ? undefined : next.data} onOpen={() => setOffset(offset + 1)} />
            <BankCheck plan={data} />
            <Section>
              <List>
                <Row icon={Plus} label={`Add to ${monthOf(data)}`} accent onPress={() => router.push({ pathname: '/sheets/plan-entry', params })} />
                <Row icon={ClipboardPaste} label="Paste a list" accent onPress={() => router.push({ pathname: '/sheets/plan-paste', params })} />
              </List>
            </Section>
            <BillInbox plan={data} householdId={householdId} />
            <PlanLines plan={data} offset={offset} viewerId={me.data?.id ?? ''} householdNames={householdNames} />
            <Section>
              <List>
                <Row icon={Wallet} label={data.viewerIncomeCount === 0 ? 'Add your pay' : 'Add income'} onPress={() => router.push('/sheets/plan-income')} />
                <Row icon={PiggyBank} label="Add savings" onPress={() => router.push('/sheets/plan-goal')} />
                <Row icon={Receipt} label="All bills & subscriptions" onPress={() => router.navigate('/bills')} />
              </List>
            </Section>
          </Stale>
        )}
      </TabScreen>
    </>
  );
}

/**
 * What to do first: add your pay when there's none, or share it with the household in view. A
 * household plan only loads what's shared with it, so judging by its list alone told someone with
 * a salary to start with their pay.
 */
function StartHere({ plan, householdNames }: { plan: WirePlan; householdNames: Record<string, string> }) {
  const router = useRouter();
  // The scope these figures are for, not the one just picked: while another loads, these stay.
  const householdId = plan.scope.type === 'household' ? plan.scope.householdId : undefined;
  const share = useSaveIncome();
  const primary = plan.primaryIncome;
  const householdName = householdId ? householdNames[householdId] ?? 'this household' : null;

  if (plan.flags.includes('no_income') && !primary && plan.viewerIncomeCount === 0) {
    return (
      <Section>
        <Notice tone="neutral" title="Start with your pay">Add what comes in and when, and the plan runs payday to payday.</Notice>
        <Button label="Add your pay" icon={Wallet} onPress={() => router.push('/sheets/plan-income')} style={{ marginTop: space.md }} />
      </Section>
    );
  }
  if (householdId && primary && primary.householdId !== householdId) {
    const where = primary.householdId ? `is shared with ${householdNames[primary.householdId] ?? 'another household'}` : 'is only in your own plan';
    return (
      <Section>
        <Notice tone="neutral" title={`Your pay isn't shared with ${householdName}`}>
          {`${primary.name} ${where}, so it isn't counted here${plan.flags.includes('no_income') ? ", and nobody else has shared theirs" : ''}. Share it if the household plans with it; your own plan uses it either way.`}
        </Notice>
        <Button
          label={`Share ${primary.name}`}
          icon={Users}
          variant={plan.flags.includes('no_income') ? 'primary' : 'secondary'}
          loading={share.isPending}
          onPress={() => share.mutate({ id: primary.id, data: { householdId } }, { onSuccess: success })}
          style={{ marginTop: space.md }}
        />
        {!!share.error && <Text variant="footnote" ink="bad" style={{ marginTop: space.sm }}>{share.error.message}</Text>}
      </Section>
    );
  }
  return null;
}

function PeriodSwitcher({ plan, offset, onChange, loading }: { plan: WirePlan | undefined; offset: number; onChange: (offset: number) => void; loading: boolean }) {
  const { colors } = useTheme();
  const arrow = (direction: -1 | 1) => {
    const Icon = direction < 0 ? ChevronLeft : ChevronRight;
    return (
      <Pressable
        onPress={() => {
          selectionTick();
          onChange(offset + direction);
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={direction < 0 ? 'Previous month' : 'Next month'}
        style={({ pressed }) => ({ width: 44, height: 44, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.cardPressed : colors.card })}
      >
        <Icon size={22} color={colors.text} />
      </Pressable>
    );
  };
  return (
    <View style={{ marginHorizontal: GUTTER, marginBottom: space.lg, gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        {arrow(-1)}
        <View style={{ flex: 1, alignItems: 'center' }} accessibilityLiveRegion="polite" aria-busy={loading}>
          {Math.abs(offset) <= 1 && <Text variant="caption" ink="accent">{offset === 0 ? 'This month' : offset === 1 ? 'Next month' : 'Last month'}</Text>}
          <Text variant="heading" ink={loading ? 'muted' : 'primary'}>{plan?.period.label ?? ' '}</Text>
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 18 }}>
              <ActivityIndicator size="small" color={colors.textMuted} style={{ transform: [{ scale: 0.7 }] }} />
              <Text variant="footnote" ink="muted">Loading</Text>
            </View>
          ) : (
            // The period's end is the next payday, so the last day in it is the day before (as the website shows).
            !!plan && (
              <Text variant="footnote" ink="muted">
                {plan.period.calendarMonth ? 'Calendar month · add your pay to plan payday to payday' : `${shortDay(plan.period.start)} – ${shortDay(addDays(plan.period.end, -1))}`}
              </Text>
            )
          )}
        </View>
        {arrow(1)}
      </View>
      {offset !== 0 && <Button label="Back to this month" variant="plain" size="sm" onPress={() => onChange(0)} style={{ alignSelf: 'center' }} />}
    </View>
  );
}

/**
 * What's left, and how it gets there, in the order people work it out: the pay, the bills, what's
 * left after the bills, then subscriptions, savings and this month's one-offs.
 */
function Summary({ plan }: { plan: WirePlan }) {
  const { colors } = useTheme();
  const { outgoingCents, weeklyCents, paidOutCents, toGoCents } = plan.totals;
  if (plan.flags.includes('no_income')) return null;
  const breakdown = planBreakdown(plan.lines);
  // "Includes 2 estimates · 1 overdue · 1 USD item not counted", as on the website.
  const notes = planNotes(plan.lines, { estimates: false });
  const over = breakdown.leftCents < 0;
  const paidShare = outgoingCents > 0 ? Math.min(1, paidOutCents / outgoingCents) : 0;
  const money = (cents: number) => formatCents(Math.abs(cents), plan.currency);
  const current = plan.daysLeft !== null;
  const month = monthOf(plan);
  const rows: Array<{ label: string; cents: number; minus?: boolean; estimate?: boolean; total?: boolean; hint?: string }> = [
    { label: 'Coming in', cents: breakdown.incomeCents },
    { label: 'Bills', cents: breakdown.billsCents, minus: true, estimate: breakdown.estimated, hint: breakdown.estimated ? 'Includes estimates' : undefined },
    { label: 'After bills', cents: breakdown.afterBillsCents, total: true, hint: 'What you have once the bills are paid' },
    ...(breakdown.subscriptionsCents ? [{ label: 'Subscriptions', cents: breakdown.subscriptionsCents, minus: true }] : []),
    ...(breakdown.savingsCents ? [{ label: 'Savings', cents: breakdown.savingsCents, minus: true }] : []),
    ...(breakdown.oneOffsCents ? [{ label: `Just for ${month}`, cents: breakdown.oneOffsCents, minus: true }] : []),
  ];

  return (
    <Section footer={breakdown.estimated ? `An estimate (~) is a bill on its usual amount until the bill comes in. Tap its amount below to set ${month}'s.` : undefined}>
      <Card padded>
        <View style={{ gap: space.xs }}>
          <Text variant="footnote" ink="muted">{over ? `Over in ${month} by` : current ? 'Left this month' : `Left in ${month}`}</Text>
          <Text variant="largeTitle" ink={over ? 'bad' : 'primary'} tabular accessibilityLabel={`${over ? 'Over by' : 'Left'} ${money(breakdown.leftCents)}`}>
            {money(breakdown.leftCents)}
          </Text>
          {!over && <Text variant="callout" ink="secondary" tabular>{`${formatCents(weeklyCents, plan.currency)} a week`}</Text>}
        </View>

        <View style={{ marginTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.separator }}>
          {rows.map((row) => (
            <View
              key={row.label}
              accessible
              accessibilityLabel={`${row.label}${row.minus ? ', minus' : ''} ${row.estimate ? 'about ' : ''}${money(row.cents)}`}
              style={[
                { flexDirection: 'row', alignItems: 'baseline', paddingVertical: space.sm, gap: space.md },
                row.total && { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, marginVertical: space.xs },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text variant="callout" weight={row.total ? 'semibold' : 'regular'} ink={row.total ? 'primary' : 'secondary'}>{row.label}</Text>
                {!!row.hint && <Text variant="caption" ink="muted">{row.hint}</Text>}
              </View>
              <Text
                variant={row.total ? 'heading' : 'callout'}
                weight="semibold"
                ink={row.label === 'Coming in' ? 'good' : row.total && row.cents < 0 ? 'bad' : 'primary'}
                tabular
              >
                {`${row.minus ? '− ' : ''}${row.total && row.cents < 0 ? `${money(row.cents)} over` : money(row.cents)}`}
              </Text>
            </View>
          ))}
        </View>

        {current && (
          <View style={{ marginTop: space.md, gap: space.xs }} accessible accessibilityLabel={`${formatCents(paidOutCents, plan.currency)} paid, ${formatCents(toGoCents, plan.currency)} still to go`}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.field, overflow: 'hidden' }}>
              <View style={{ width: `${paidShare * 100}%`, height: 6, backgroundColor: colors.accent }} />
            </View>
            <Text variant="footnote" ink="muted" tabular>{`${formatCents(paidOutCents, plan.currency)} paid · ${formatCents(toGoCents, plan.currency)} still to go`}</Text>
          </View>
        )}
        {notes.length > 0 && <Text variant="footnote" ink="muted" style={{ marginTop: space.sm }}>{notes.join(' · ')}</Text>}
      </Card>
    </Section>
  );
}

/** The month after this one, at a glance: planning ahead (a big card bill now) starts from here. */
function NextMonth({ plan, onOpen }: { plan: WirePlan | undefined; onOpen: () => void }) {
  if (!plan || plan.flags.includes('no_income')) return null;
  const breakdown = planBreakdown(plan.lines);
  const money = (cents: number) => formatCents(Math.abs(cents), plan.currency);
  const left = breakdown.leftCents < 0 ? `${money(breakdown.leftCents)} over` : `${money(breakdown.leftCents)} left`;
  return (
    <Section>
      <List>
        <Row
          icon={CalendarClock}
          label={`Plan ${monthOf(plan)}`}
          detail={`${left} · ${money(breakdown.afterBillsCents)} after bills`}
          onPress={onOpen}
          accessibilityHint={`Shows ${plan.period.label}, to set its amounts ahead`}
        />
      </List>
    </Section>
  );
}

/**
 * How the plan works, until it's been read once: the three things that aren't obvious from the
 * screen (bills first, an amount can change for one month, and next month can be planned now).
 */
function HowItWorks() {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(INTRO_KEY).then((value) => setSeen(value === '1')).catch(() => setSeen(true));
  }, []);
  if (seen !== false) return null;
  const points = [
    'Each month runs from one payday to the next: your pay comes in, then the bills go out.',
    'After bills is what you have once the essentials are paid. Subscriptions, savings and one-offs come out of that.',
    'A bill different this month, like a bigger credit card bill? Tap its amount. Only that month changes.',
    'Use the arrows to plan next month before it starts.',
  ];
  return (
    <Section>
      <Card padded>
        <Text variant="label" accessibilityRole="header">How your plan works</Text>
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          {points.map((point) => (
            <View key={point} style={{ flexDirection: 'row', gap: space.sm }}>
              <Text variant="callout" ink="muted">·</Text>
              <Text variant="callout" ink="secondary" style={{ flex: 1 }}>{point}</Text>
            </View>
          ))}
        </View>
        <Button
          label="Got it"
          variant="secondary"
          size="sm"
          onPress={() => {
            setSeen(true);
            void AsyncStorage.setItem(INTRO_KEY, '1').catch(() => undefined);
          }}
          style={{ alignSelf: 'flex-start', marginTop: space.md }}
        />
      </Card>
    </Section>
  );
}
