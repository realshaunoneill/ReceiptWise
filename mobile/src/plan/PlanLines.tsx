import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, FileText, Users } from 'lucide-react-native';
import { type WirePlan } from '@shared/api/plan';
import { formatCents } from '@shared/currency';
import { PAYMENT_METHOD_LABEL } from '@shared/labels/plan';
import { fromCents } from '@shared/money';
import { choose, confirm } from '../confirm';
import { useTheme } from '../contexts/ThemeContext';
import { openPrivateFile } from '../files';
import { useAddContribution, useDeleteEntry, useRemoveContributions, useUpdateEntry, useUpdateOccurrence } from '../hooks/usePlan';
import { radius, space } from '../theme';
import { selectionTick } from '../ui/Button';
import { Pill } from '../ui/Feedback';
import { List, Section } from '../ui/Section';
import Text from '../ui/Text';
import { monthOf, settleDay, shortDay } from './days';

type Line = WirePlan['lines'][number];
type Goal = WirePlan['goals'][number];
type Context = { plan: WirePlan; offset: number; viewerId: string; householdNames: Record<string, string> };

const sum = (lines: Line[]) => lines.filter((line) => line.counted).reduce((total, line) => total + line.amountCents, 0);

/** The amount sheet (app/sheets/plan-amount.tsx) for this line, this period only. */
function useAmountSheet() {
  const router = useRouter();
  return (line: Line, extra: Record<string, string>) => router.push({
    pathname: '/sheets/plan-amount',
    params: { label: line.label, cents: String(line.amountCents), currency: line.currency, ...extra },
  });
}

/** The plan's lines, grouped as on the website: in, bills, savings, then the month's one-offs. */
export default function PlanLines({ plan, offset, viewerId, householdNames }: Context) {
  const incoming = plan.lines.filter((line) => line.direction === 'in');
  const recurring = plan.lines.filter((line) => line.direction === 'out' && line.source === 'recurring');
  const goals = plan.lines.filter((line) => line.source === 'goal');
  const oneOffs = plan.lines.filter((line) => line.direction === 'out' && line.source === 'entry');
  // Goals with a target but nothing to put aside this period still show their progress.
  const progressOnly = plan.goals.filter((goal) => goal.targetCents && !goals.some((line) => line.sourceId === goal.id));
  const context = { plan, offset, viewerId, householdNames };
  const total = (lines: Line[]) => <Text variant="callout" ink="muted" tabular>{formatCents(sum(lines), plan.currency)}</Text>;

  return (
    <>
      {incoming.length > 0 && (
        <Section title="Coming in" accessory={total(incoming)}>
          <List inset={60}>
            {incoming.map((line) => (line.source === 'entry'
              ? <EntryRow key={line.key} line={line} context={context} />
              : <IncomeRow key={line.key} line={line} context={context} />))}
          </List>
        </Section>
      )}
      {recurring.length > 0 && (
        <Section title="Bills & subscriptions" accessory={total(recurring)}>
          <List inset={60}>{recurring.map((line) => <RecurringRow key={line.key} line={line} context={context} />)}</List>
        </Section>
      )}
      {(goals.length > 0 || progressOnly.length > 0) && (
        <Section title="Savings" accessory={total(goals)}>
          <List inset={60}>
            {goals.map((line) => <GoalRow key={line.key} line={line} context={context} />)}
            {progressOnly.map((goal) => <GoalOnly key={goal.id} goal={goal} currency={plan.currency} />)}
          </List>
        </Section>
      )}
      {oneOffs.length > 0 && (
        <Section title={`Just for ${monthOf(plan)}`} accessory={total(oneOffs)}>
          <List inset={60}>{oneOffs.map((line) => <EntryRow key={line.key} line={line} context={context} />)}</List>
        </Section>
      )}
    </>
  );
}

function IncomeRow({ line, context }: { line: Line; context: Context }) {
  const router = useRouter();
  return (
    <Shell
      line={line}
      context={context}
      detail={`${shortDay(line.date)} · ${line.status === 'paid' ? 'Arrived' : 'Due'}`}
      amountInk="good"
      onPress={() => router.push({ pathname: '/sheets/plan-income', params: { id: line.sourceId } })}
      accessibilityHint="Edit this income"
    />
  );
}

function RecurringRow({ line, context }: { line: Line; context: Context }) {
  const router = useRouter();
  const openAmount = useAmountSheet();
  const update = useUpdateOccurrence(line.sourceId);
  // While a change saves and the plan refreshes, show it as made; a failure puts it back.
  const saving = update.isPending ? update.variables?.data : undefined;
  const paid = saving?.status ? saving.status === 'paid' : line.status === 'paid';
  const skipped = saving?.status ? saving.status === 'skipped' : line.status === 'skipped';
  const method = line.paymentMethod ? PAYMENT_METHOD_LABEL[line.paymentMethod] : undefined;
  const change = (data: Parameters<typeof update.mutate>[0]['data']) => update.mutate({ expectedDate: line.cycleDate!, data });
  const amount = () => openAmount(line, { kind: 'occurrence', id: line.sourceId, cycleDate: line.cycleDate!, paid: paid ? '1' : '' });

  const menu = async () => {
    const options = [
      { label: 'Change the amount', run: amount, show: !skipped },
      { label: "Don't skip", run: () => change({ status: 'pending' }), show: skipped },
      { label: 'Skip this time', run: () => change({ status: 'skipped' }), show: !skipped && !paid },
      { label: 'Bill details', run: () => router.push({ pathname: '/bills/[id]', params: { id: line.sourceId } }), show: true },
      ...viewBill(line).map((option) => ({ ...option, show: true })),
    ].filter((option) => option.show);
    const index = await choose(line.label, options.map((option) => ({ label: option.label })));
    if (index !== null) options[index].run();
  };

  return (
    <Shell
      line={line}
      context={context}
      checked={paid}
      disabled={update.isPending || skipped}
      onToggle={(checked) => change(
        // Unticking an assumed direct debit means it didn't go out: missed, which the daily job
        // won't assume paid again.
        checked ? { status: 'paid', actualDate: settleDay(context.plan) } : line.paidVia === 'assumed' ? { status: 'missed' } : { status: 'pending' },
      )}
      checkLabel={paid ? `Mark ${line.label} not paid` : `Mark ${line.label} paid`}
      detail={[shortDay(line.date), method].filter(Boolean).join(' · ')}
      badges={(
        <>
          {line.paidVia === 'assumed' && paid && <Pill label="Assumed paid" tone="neutral" />}
          {line.paidVia === 'receipt' && paid && <Pill label="Receipt" tone="neutral" />}
          {line.status === 'overdue' && !saving?.status && <Pill label="Overdue" tone="bad" />}
          {line.estimated && !paid && <Pill label="Estimate" tone="warn" />}
          {skipped && <Pill label="Skipped" tone="neutral" />}
        </>
      )}
      estimated={line.estimated && !paid}
      onPress={() => void menu()}
      onAmountPress={skipped ? undefined : amount}
      accessibilityHint="Change the amount, skip it, or see the bill"
      error={update.error?.message}
    />
  );
}

function EntryRow({ line, context }: { line: Line; context: Context }) {
  const router = useRouter();
  const openAmount = useAmountSheet();
  const update = useUpdateEntry();
  const remove = useDeleteEntry();
  const isOwner = line.ownerUserId === context.viewerId;
  const saving = update.isPending ? update.variables?.data : undefined;
  const done = saving?.done ?? line.status === 'done';
  const edit = () => router.push({ pathname: '/sheets/plan-entry', params: { id: line.sourceId, offset: String(context.offset) } });

  const menu = async () => {
    const options = [
      ...(isOwner ? [
        { label: 'Change the amount', run: () => openAmount(line, { kind: 'entry', id: line.sourceId }) },
        { label: 'Edit', run: edit },
      ] : []),
      ...viewBill(line),
      ...(isOwner ? [{
        label: 'Remove',
        destructive: true,
        run: async () => {
          if (await confirm(`Remove ${line.label}?`, `It comes out of ${monthOf(context.plan)}'s plan.`, 'Remove')) remove.mutate(line.sourceId);
        },
      }] : []),
    ];
    const index = await choose(line.label, options);
    if (index !== null) void options[index].run();
  };

  return (
    <Shell
      line={line}
      context={context}
      checked={done}
      disabled={update.isPending || !isOwner}
      onToggle={line.direction === 'out' ? (checked) => update.mutate({ id: line.sourceId, data: { done: checked } }) : undefined}
      checkLabel={done ? `Mark ${line.label} not done` : `Mark ${line.label} done`}
      detail={[shortDay(line.date), line.category ?? undefined].filter(Boolean).join(' · ')}
      amountInk={line.direction === 'in' ? 'good' : undefined}
      onPress={isOwner || line.billDocumentId ? () => void menu() : undefined}
      onAmountPress={isOwner ? () => openAmount(line, { kind: 'entry', id: line.sourceId }) : undefined}
      accessibilityHint="Change the amount, edit or remove it"
      error={update.error?.message ?? remove.error?.message}
    />
  );
}

function GoalRow({ line, context }: { line: Line; context: Context }) {
  const router = useRouter();
  const add = useAddContribution();
  const remove = useRemoveContributions();
  const done = add.isPending ? true : remove.isPending ? false : line.status === 'done';
  const summary = context.plan.goals.find((goal) => goal.id === line.sourceId);
  return (
    <Shell
      line={line}
      context={context}
      checked={done}
      disabled={add.isPending || remove.isPending}
      onToggle={(checked) => (checked
        ? add.mutate({ goalId: line.sourceId, amount: fromCents(line.amountCents), contributedOn: settleDay(context.plan) })
        : remove.mutate({ goalId: line.sourceId, contributionIds: line.contributionIds ?? [] }))}
      checkLabel={done ? `Undo putting aside for ${line.label}` : `Mark ${line.label} put aside`}
      detail="Savings"
      onPress={() => router.push({ pathname: '/sheets/plan-goal', params: { id: line.sourceId } })}
      accessibilityHint="Edit this goal"
      below={summary ? <GoalProgress goal={summary} currency={context.plan.currency} /> : undefined}
      error={add.error?.message ?? remove.error?.message}
    />
  );
}

/** A goal with a target but nothing to put aside this period: just how far along it is. */
function GoalOnly({ goal, currency }: { goal: Goal; currency: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/sheets/plan-goal', params: { id: goal.id } })}
      accessibilityRole="button"
      style={({ pressed }) => ({ paddingLeft: 60, paddingRight: space.lg, paddingVertical: space.md, gap: space.xs, backgroundColor: pressed ? colors.cardPressed : 'transparent' })}
    >
      <Text variant="callout" weight="medium">{goal.name}</Text>
      <GoalProgress goal={goal} currency={currency} />
    </Pressable>
  );
}

function GoalProgress({ goal, currency }: { goal: Goal; currency: string }) {
  const { colors } = useTheme();
  if (!goal.targetCents) return null;
  const share = Math.min(1, goal.savedCents / goal.targetCents);
  const saved = `${formatCents(goal.savedCents, currency)} of ${formatCents(goal.targetCents, currency)}${goal.linkedAccount ? ` · in ${goal.linkedAccount.name}` : ''}`;
  return (
    <View style={{ gap: 4, marginTop: 4 }} accessible accessibilityLabel={`${goal.name}: ${saved} saved`}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.field, overflow: 'hidden' }}>
        <View style={{ width: `${share * 100}%`, height: 4, backgroundColor: colors.accent }} />
      </View>
      <Text variant="footnote" ink="muted" tabular>{saved}</Text>
      {goal.onTrack === false && goal.neededPerCycleCents !== null && (
        <Text variant="footnote" ink="warn" tabular>{`${formatCents(goal.neededPerCycleCents, currency)} a month needed to reach it in time`}</Text>
      )}
    </View>
  );
}

/** A plan line: the tick (44 pt to tap), its name, date and badges, and the amount. */
function Shell({ line, context, checked, disabled, onToggle, checkLabel, detail, badges, estimated, amountInk, onPress, onAmountPress, accessibilityHint, below, error }: {
  line: Line;
  context: Context;
  checked?: boolean;
  disabled?: boolean;
  onToggle?: (checked: boolean) => void;
  checkLabel?: string;
  detail?: string;
  badges?: React.ReactNode;
  estimated?: boolean;
  amountInk?: 'good';
  onPress?: () => void;
  onAmountPress?: () => void;
  accessibilityHint?: string;
  below?: React.ReactNode;
  error?: string;
}) {
  const { colors } = useTheme();
  const struck = line.status === 'skipped' || line.notCountedReason === 'other_currency';
  const amount = `${estimated ? '~' : ''}${formatCents(line.amountCents, line.currency)}`;
  // In your own plan, say which lines a household sees too.
  const sharedWith = context.plan.scope.type === 'mine' && line.householdId ? context.householdNames[line.householdId] ?? 'your household' : null;
  const notCounted = line.notCountedReason === 'other_currency' ? `not counted (${line.currency})` : undefined;

  // The tick, the line and the amount are three controls side by side, not one inside another: a
  // button inside a button hid the tick and the amount from VoiceOver (and isn't valid on the web).
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: space.lg, minHeight: 56 }}>
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
          accessibilityLabel={checkLabel}
          style={{ width: 60, height: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled && !checked ? 0.5 : 1 }}
        >
          <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: checked ? 0 : 2, borderColor: colors.textMuted, backgroundColor: checked ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {checked && <Check size={16} color={colors.onAccent} strokeWidth={3} />}
          </View>
        </Pressable>
      ) : (
        <View style={{ width: 60 }} />
      )}
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${line.label}, ${amount}${detail ? `, ${detail}` : ''}`}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => ({ flex: 1, gap: 2, paddingVertical: space.sm, alignSelf: 'stretch', justifyContent: 'center', backgroundColor: pressed ? colors.cardPressed : 'transparent' })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Text
            variant="callout"
            weight="medium"
            ink={struck || checked ? 'muted' : 'primary'}
            numberOfLines={1}
            style={[{ flexShrink: 1 }, struck && { textDecorationLine: 'line-through' }]}
          >
            {line.label}
          </Text>
          {!!sharedWith && <Users size={13} color={colors.textMuted} accessibilityLabel={`Shared with ${sharedWith}`} />}
        </View>
        {!!(detail || notCounted) && <Text variant="footnote" ink="muted" numberOfLines={1}>{[detail, notCounted].filter(Boolean).join(' · ')}</Text>}
        {(!!badges || !!line.billDocumentId) && (
          <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap', marginTop: 2 }}>
            {badges}
            {!!line.billDocumentId && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border }}>
                <FileText size={12} color={colors.textSecondary} />
                <Text variant="caption" ink="secondary">From a bill</Text>
              </View>
            )}
          </View>
        )}
        {below}
        {!!error && <Text variant="footnote" ink="bad">{error}</Text>}
      </Pressable>
      <Pressable
        onPress={onAmountPress}
        disabled={!onAmountPress}
        hitSlop={8}
        accessibilityRole={onAmountPress ? 'button' : undefined}
        accessibilityLabel={onAmountPress ? `${amount}. Change the amount for this period` : undefined}
        style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6, marginRight: -6, borderRadius: radius.md, backgroundColor: pressed ? colors.field : 'transparent' })}
      >
        <Text variant="callout" weight="semibold" ink={amountInk ?? (estimated || struck ? 'muted' : 'primary')} tabular>{amount}</Text>
      </Pressable>
    </View>
  );
}

/** The bill a line's amount was read from, if any: opened from the line's menu. */
const viewBill = (line: Line) => (line.billDocumentId
  ? [{ label: 'View the bill', run: () => void openPrivateFile(`/api/bills/documents/${line.billDocumentId}/file`, `${line.label} bill`) }]
  : []);
