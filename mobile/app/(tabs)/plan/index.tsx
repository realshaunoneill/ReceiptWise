import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Check, ChevronLeft, ChevronRight, Users } from 'lucide-react-native';
import { formatCents } from '@shared/currency';
import { type WirePlan } from '@shared/api/plan';
import { formatLocalDate, localToday } from '@shared/dates/local-date';
import { PAYMENT_METHOD_LABEL } from '@shared/labels/plan';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { useMe } from '../../../src/hooks/useMe';
import { useAddContribution, usePlan, useRemoveContributions, useUpdateEntry, useUpdateOccurrence } from '../../../src/hooks/usePlan';
import { GUTTER, radius, space } from '../../../src/theme';
import Button, { selectionTick } from '../../../src/ui/Button';
import { LoadError, Notice, Pill, Skeleton } from '../../../src/ui/Feedback';
import { Card, List, Section } from '../../../src/ui/Section';
import TabScreen from '../../../src/ui/TabScreen';
import Text from '../../../src/ui/Text';

type Line = WirePlan['lines'][number];

/** The day to record a payment on: today if it's in the period, else the period's first day. */
function settleDay(plan: WirePlan): string {
  const today = localToday();
  return today >= plan.period.start && today < plan.period.end ? today : plan.period.start;
}

const sum = (lines: Line[]) => lines.filter((line) => line.counted).reduce((total, line) => total + line.amountCents, 0);
const shortDay = (day: string) => formatLocalDate(day, { day: 'numeric', month: 'short' }, 'en-IE');

/** The month, payday to payday: what comes in, what goes out, and what's left. */
export default function Plan() {
  const [offset, setOffset] = useState(0);
  const me = useMe();
  const plan = usePlan(offset);

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

  return (
    <TabScreen onRefresh={() => void plan.refetch()} refreshing={plan.isRefetching}>
      <PeriodSwitcher plan={plan.data} offset={offset} onChange={setOffset} />
      {plan.isError && !plan.data ? (
        <LoadError message={plan.error.message} onRetry={() => void plan.refetch()} />
      ) : !plan.data ? (
        <View style={{ marginHorizontal: GUTTER, gap: space.lg }}>
          <Skeleton height={140} round={radius.lg} />
          <Skeleton height={220} round={radius.lg} />
        </View>
      ) : (
        <>
          <Summary plan={plan.data} />
          <Lines plan={plan.data} viewerId={me.data?.id ?? ''} />
        </>
      )}
    </TabScreen>
  );
}

function PeriodSwitcher({ plan, offset, onChange }: { plan: WirePlan | undefined; offset: number; onChange: (offset: number) => void }) {
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
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text variant="heading">{plan?.period.label ?? ' '}</Text>
          {!!plan && <Text variant="footnote" ink="muted">{`${shortDay(plan.period.start)} – ${shortDay(plan.period.end)}`}</Text>}
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
  if (plan.flags.includes('no_income')) {
    return (
      <Section>
        <Notice tone="neutral" title="Start with your pay">
          Add your pay on the website's Plan for now, and this month fills in from payday to payday.
        </Notice>
      </Section>
    );
  }
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

function Lines({ plan, viewerId }: { plan: WirePlan; viewerId: string }) {
  const incoming = plan.lines.filter((line) => line.direction === 'in');
  const recurring = plan.lines.filter((line) => line.direction === 'out' && line.source === 'recurring');
  const goals = plan.lines.filter((line) => line.source === 'goal');
  const oneOffs = plan.lines.filter((line) => line.direction === 'out' && line.source === 'entry');
  const month = plan.period.label.split(' ')[0];
  const total = (lines: Line[]) => <Text variant="callout" ink="muted" tabular>{formatCents(sum(lines), plan.currency)}</Text>;
  const group = (title: string, lines: Line[]) => lines.length > 0 && (
    <Section key={title} title={title} accessory={total(lines)}>
      <List inset={60}>{lines.map((line) => <LineRow key={line.key} line={line} plan={plan} viewerId={viewerId} />)}</List>
    </Section>
  );
  return (
    <>
      {group('Coming in', incoming)}
      {group('Bills & subscriptions', recurring)}
      {group('Savings', goals)}
      {group(`Just for ${month}`, oneOffs)}
    </>
  );
}

function LineRow({ line, plan, viewerId }: { line: Line; plan: WirePlan; viewerId: string }) {
  if (line.source === 'income') return <Static line={line} />;
  if (line.source === 'recurring') return <RecurringRow line={line} plan={plan} />;
  if (line.source === 'goal') return <GoalRow line={line} plan={plan} />;
  return <EntryRow line={line} canEdit={line.ownerUserId === viewerId} />;
}

/** Income: no tick, just whether it has arrived. */
function Static({ line }: { line: Line }) {
  return <Shell line={line} detail={`${shortDay(line.date)} · ${line.status === 'paid' ? 'Arrived' : 'Due'}`} amountInk="good" />;
}

function RecurringRow({ line, plan }: { line: Line; plan: WirePlan }) {
  const update = useUpdateOccurrence(line.sourceId);
  // While a change saves and the plan refreshes, show it as made; a failure puts it back.
  const saving = update.isPending ? update.variables?.data : undefined;
  const paid = saving?.status ? saving.status === 'paid' : line.status === 'paid';
  const skipped = saving?.status ? saving.status === 'skipped' : line.status === 'skipped';
  const method = line.paymentMethod ? PAYMENT_METHOD_LABEL[line.paymentMethod] : undefined;
  return (
    <Shell
      line={line}
      checked={paid}
      disabled={update.isPending || skipped}
      onToggle={(checked) => update.mutate({
        expectedDate: line.cycleDate!,
        // Unticking an assumed direct debit means it didn't go out: missed, which the daily job
        // won't assume paid again.
        data: checked ? { status: 'paid', actualDate: settleDay(plan) } : line.paidVia === 'assumed' ? { status: 'missed' } : { status: 'pending' },
      })}
      detail={[shortDay(line.date), method].filter(Boolean).join(' · ')}
      badges={(
        <>
          {line.paidVia === 'assumed' && paid && <Pill label="Assumed paid" tone="neutral" />}
          {line.status === 'overdue' && !saving?.status && <Pill label="Overdue" tone="bad" />}
          {line.estimated && !paid && <Pill label="Estimate" tone="warn" />}
          {skipped && <Pill label="Skipped" tone="neutral" />}
        </>
      )}
      estimated={line.estimated && !paid}
      error={update.error?.message}
    />
  );
}

function EntryRow({ line, canEdit }: { line: Line; canEdit: boolean }) {
  const update = useUpdateEntry();
  const saving = update.isPending ? update.variables?.data : undefined;
  const done = saving?.done ?? line.status === 'done';
  return (
    <Shell
      line={line}
      checked={done}
      disabled={update.isPending || !canEdit}
      onToggle={(checked) => update.mutate({ id: line.sourceId, data: { done: checked } })}
      detail={[shortDay(line.date), line.category ?? undefined].filter(Boolean).join(' · ')}
      error={update.error?.message}
    />
  );
}

function GoalRow({ line, plan }: { line: Line; plan: WirePlan }) {
  const add = useAddContribution();
  const remove = useRemoveContributions();
  const done = add.isPending ? true : remove.isPending ? false : line.status === 'done';
  return (
    <Shell
      line={line}
      checked={done}
      disabled={add.isPending || remove.isPending}
      onToggle={(checked) => (checked
        ? add.mutate({ goalId: line.sourceId, amount: (line.amountCents / 100).toFixed(2), contributedOn: settleDay(plan) })
        : remove.mutate({ goalId: line.sourceId, contributionIds: line.contributionIds ?? [] }))}
      detail="Savings"
      error={add.error?.message ?? remove.error?.message}
    />
  );
}

/** A plan line: the tick (44 pt to tap), its name and date, any badges, and the amount. */
function Shell({ line, checked, disabled, onToggle, detail, badges, estimated, amountInk, error }: {
  line: Line;
  checked?: boolean;
  disabled?: boolean;
  onToggle?: (checked: boolean) => void;
  detail?: string;
  badges?: React.ReactNode;
  estimated?: boolean;
  amountInk?: 'good';
  error?: string;
}) {
  const { colors } = useTheme();
  const amount = `${estimated ? '~' : ''}${formatCents(line.amountCents, line.currency)}`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm, paddingRight: space.lg, minHeight: 56 }}>
      {onToggle ? (
        <Pressable
          onPress={() => {
            selectionTick();
            onToggle(!checked);
          }}
          disabled={disabled}
          accessibilityRole="checkbox"
          aria-checked={!!checked}
          aria-disabled={!!disabled}
          accessibilityLabel={checked ? `Mark ${line.label} not paid` : `Mark ${line.label} paid`}
          style={{ width: 60, height: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled && !checked ? 0.5 : 1 }}
        >
          <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: checked ? 0 : 2, borderColor: colors.textMuted, backgroundColor: checked ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {checked && <Check size={16} color={colors.onAccent} strokeWidth={3} />}
          </View>
        </Pressable>
      ) : (
        <View style={{ width: 60 }} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Text variant="callout" weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>{line.label}</Text>
          {!!line.householdId && <Users size={13} color={colors.textMuted} accessibilityLabel="Shared" />}
        </View>
        {!!detail && <Text variant="footnote" ink="muted" numberOfLines={1}>{detail}</Text>}
        {!!badges && <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap', marginTop: 2 }}>{badges}</View>}
        {!!error && <Text variant="footnote" ink="bad">{error}</Text>}
      </View>
      <Text variant="callout" weight="semibold" ink={amountInk ?? (estimated ? 'muted' : 'primary')} tabular>{amount}</Text>
    </View>
  );
}
