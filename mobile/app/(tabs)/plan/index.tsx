import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, ClipboardPaste, PiggyBank, Plus, Receipt, Users, Wallet } from 'lucide-react-native';
import { formatCents } from '@shared/currency';
import { type WirePlan } from '@shared/api/plan';
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

/** The month, payday to payday: what comes in, what goes out, and what's left. */
export default function Plan() {
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const me = useMe();
  const { householdId } = useScope();
  const plan = usePlan(offset, householdId);
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
            <Summary plan={data} />
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
          <Text variant="heading" ink={loading ? 'muted' : 'primary'}>{plan?.period.label ?? ' '}</Text>
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 18 }}>
              <ActivityIndicator size="small" color={colors.textMuted} style={{ transform: [{ scale: 0.7 }] }} />
              <Text variant="footnote" ink="muted">Loading</Text>
            </View>
          ) : (
            !!plan && <Text variant="footnote" ink="muted">{`${shortDay(plan.period.start)} – ${shortDay(plan.period.end)}`}</Text>
          )}
        </View>
        {arrow(1)}
      </View>
      {offset !== 0 && <Button label="Back to this month" variant="plain" size="sm" onPress={() => onChange(0)} style={{ alignSelf: 'center' }} />}
    </View>
  );
}

function Summary({ plan }: { plan: WirePlan }) {
  const { colors } = useTheme();
  const { incomeCents, outgoingCents, remainingCents, weeklyCents, paidOutCents, toGoCents } = plan.totals;
  const over = remainingCents < 0;
  const paidShare = outgoingCents > 0 ? Math.min(1, paidOutCents / outgoingCents) : 0;
  if (plan.flags.includes('no_income')) return null;
  return (
    <Section>
      <Card padded>
        <View style={{ gap: space.xs }}>
          <Text variant="footnote" ink="muted">{over ? 'Over by' : 'Left this month'}</Text>
          <Text variant="largeTitle" ink={over ? 'bad' : 'primary'} tabular accessibilityLabel={`${over ? 'Over by' : 'Left'} ${formatCents(Math.abs(remainingCents), plan.currency)}`}>
            {formatCents(Math.abs(remainingCents), plan.currency)}
          </Text>
          {!over && <Text variant="callout" ink="secondary" tabular>{`${formatCents(weeklyCents, plan.currency)} a week`}</Text>}
        </View>
        <View style={{ flexDirection: 'row', marginTop: space.lg, gap: space.lg }}>
          <View style={{ flex: 1 }}>
            <Text variant="footnote" ink="muted">Coming in</Text>
            <Text variant="callout" weight="semibold" ink="good" tabular>{formatCents(incomeCents, plan.currency)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="footnote" ink="muted">Going out</Text>
            <Text variant="callout" weight="semibold" tabular>{formatCents(outgoingCents, plan.currency)}</Text>
          </View>
        </View>
        <View style={{ marginTop: space.lg, gap: space.xs }} accessible accessibilityLabel={`${formatCents(paidOutCents, plan.currency)} paid, ${formatCents(toGoCents, plan.currency)} still to go`}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.field, overflow: 'hidden' }}>
            <View style={{ width: `${paidShare * 100}%`, height: 6, backgroundColor: colors.accent }} />
          </View>
          <Text variant="footnote" ink="muted" tabular>{`${formatCents(paidOutCents, plan.currency)} paid · ${formatCents(toGoCents, plan.currency)} still to go`}</Text>
        </View>
      </Card>
    </Section>
  );
}
