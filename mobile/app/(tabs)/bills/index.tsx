import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Plus, Repeat, Users } from 'lucide-react-native';
import { formatCurrency } from '@shared/currency';
import { formatTotals } from '@shared/currency-totals';
import { daysBetween, localToday } from '@shared/dates/local-date';
import { frequencyName, paymentMethodLabel } from '@shared/labels/subscriptions';
import { getUrgency } from '@shared/urgency';
import { billDay, dueLabel, filterBills, monthlyTotals, notMarkedPaid, type KindFilter, type ListedBill } from '../../../src/bills/summary';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { useBills, type BillStatus } from '../../../src/hooks/useBills';
import { useMe } from '../../../src/hooks/useMe';
import { GUTTER, radius, space } from '../../../src/theme';
import Button, { tap } from '../../../src/ui/Button';
import { Segmented } from '../../../src/ui/Controls';
import { EmptyState, LoadError, Notice, Pill, Skeleton } from '../../../src/ui/Feedback';
import { Card, List, Section } from '../../../src/ui/Section';
import Stale from '../../../src/ui/Stale';
import TabScreen from '../../../src/ui/TabScreen';
import Text from '../../../src/ui/Text';

const STATUS_EMPTY: Record<BillStatus, string> = {
  active: 'Nothing active.',
  paused: 'Nothing paused. A paused bill keeps its history and expects nothing until it is resumed.',
  cancelled: 'Nothing cancelled.',
};

/**
 * Bills and subscriptions, as on the website's page: what they come to a month and a year, the
 * payments nobody has marked paid, and each one by when it's next due. The totals are always the
 * active ones, whichever status is open.
 */
export default function Bills() {
  const router = useRouter();
  const me = useMe();
  const [status, setStatus] = useState<BillStatus>('active');
  const [kind, setKind] = useState<KindFilter>('all');
  const [missingOnly, setMissingOnly] = useState(false);
  const list = useBills(status, undefined, true);
  // On the Active tab this is the same query as the list.
  const active = useBills('active', undefined, true);
  const today = localToday();
  const billsOn = !!me.data?.features.bills;
  const currency = me.data?.currency ?? 'EUR';

  if (me.data && !me.data.subscribed && me.data.entitlements.householdIds.length === 0) {
    return (
      <TabScreen>
        <Section>
          <Notice tone="neutral" title="Bills are part of Premium">
            Every bill and subscription in one list, with what each costs you a month and when it's due.
          </Notice>
        </Section>
      </TabScreen>
    );
  }

  const add = () => router.push({ pathname: '/sheets/bill-edit', params: kind === 'all' ? {} : { kind } });
  const activeBills = active.data ?? [];
  const nothingYet = status === 'active' && list.isSuccess && list.data.length === 0;
  const missing = notMarkedPaid(activeBills);
  const monthly = monthlyTotals(activeBills, currency);
  const shown = filterBills(list.data ?? [], billsOn ? kind : 'all', missingOnly);
  const missingShown = notMarkedPaid(shown);

  return (
    <TabScreen
      onRefresh={() => Promise.all([list.refetch(), active.refetch()])}
    >
      <Stack.Screen options={{ headerRight: () => <AddButton onPress={add} label={billsOn ? 'Add a bill or subscription' : 'Add a subscription'} /> }} />
      {list.isPending ? (
        <View style={{ marginHorizontal: GUTTER, gap: space.md }}>
          <Skeleton height={96} round={radius.lg} />
          {[0, 1, 2].map((i) => <Skeleton key={i} height={64} round={radius.lg} />)}
        </View>
      ) : list.isError ? (
        <LoadError message={list.error.message} onRetry={() => void list.refetch()} />
      ) : (
        <>
          {activeBills.length > 0 && (
            <Stats
              count={activeBills.length}
              monthly={formatTotals(monthly, currency)}
              yearly={formatTotals(monthly.map((total) => ({ ...total, amount: total.amount * 12 })), currency)}
              missing={missing}
              onMissing={() => {
                setStatus('active');
                setMissingOnly(true);
              }}
            />
          )}

          <View style={{ marginHorizontal: GUTTER, marginBottom: space.lg, gap: space.sm }}>
            <Segmented<BillStatus>
              accessibilityLabel="Status"
              value={status}
              onChange={setStatus}
              options={[{ value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }, { value: 'cancelled', label: 'Cancelled' }]}
            />
            {billsOn && !nothingYet && (
              <Segmented<KindFilter>
                accessibilityLabel="Show bills, subscriptions or both"
                value={kind}
                onChange={setKind}
                options={[{ value: 'all', label: 'All' }, { value: 'bill', label: 'Bills' }, { value: 'subscription', label: 'Subscriptions' }]}
              />
            )}
          </View>

          {nothingYet && (
            <EmptyState
              icon={Repeat}
              title={billsOn ? 'No bills yet' : 'No subscriptions yet'}
              body="Add anything that comes round again, like rent, electricity, your phone or Netflix, and see when each is due."
              action={{ label: billsOn ? 'Add a bill' : 'Add a subscription', onPress: add }}
            />
          )}

          {missingOnly && (
            <Section>
              <Notice tone="warn" title="Not marked paid">
                {missingShown === 0
                  ? 'Nothing here is past due and unmarked.'
                  : `${missingShown === 1 ? '1 payment' : `${missingShown} payments`} past due across ${shown.length === 1 ? '1 item' : `${shown.length} items`}. Mark them paid, or skip them, in each one's details.`}
              </Notice>
              <Button label="Show all" variant="secondary" size="sm" onPress={() => setMissingOnly(false)} style={{ marginTop: space.md, alignSelf: 'flex-start' }} />
            </Section>
          )}

          {nothingYet ? null : shown.length === 0 ? (
            !missingOnly && (
              <Text variant="callout" ink="muted" align="center" style={{ marginHorizontal: GUTTER + space.xl, marginTop: space.xl }}>
                {kind === 'all' || !billsOn ? STATUS_EMPTY[status] : `No ${kind === 'bill' ? 'bills' : 'subscriptions'} here.`}
              </Text>
            )
          ) : (
            // Another status on its way: the last list stays, dimmed.
            <Stale stale={list.isPlaceholderData}>
              <Section>
                <List>{shown.map((bill) => <BillRow key={bill.id} bill={bill} today={today} billsOn={billsOn} />)}</List>
              </Section>
            </Stale>
          )}
        </>
      )}
    </TabScreen>
  );
}

/** What the active ones come to, and the payments past due that nobody has marked paid. */
function Stats({ count, monthly, yearly, missing, onMissing }: { count: number; monthly: string; yearly: string; missing: number; onMissing: () => void }) {
  const { colors } = useTheme();
  return (
    <Section>
      <Card padded>
        <View style={{ flexDirection: 'row', gap: space.lg }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="footnote" ink="muted">A month</Text>
            <Text variant="title" tabular adjustsFontSizeToFit numberOfLines={1}>{monthly}</Text>
            <Text variant="footnote" ink="muted" tabular>{`${yearly} a year`}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text variant="footnote" ink="muted">Active</Text>
            <Text variant="title" tabular>{String(count)}</Text>
          </View>
        </View>
        {missing > 0 && (
          <Pressable
            onPress={onMissing}
            accessibilityRole="button"
            accessibilityHint="Shows only those"
            style={({ pressed }) => ({ marginTop: space.lg, minHeight: 44, borderRadius: radius.md, paddingHorizontal: space.md, justifyContent: 'center', backgroundColor: pressed ? colors.cardPressed : colors.warnSoft })}
          >
            <Text variant="callout" weight="medium" ink="warn">{`${missing} not marked paid · Show them`}</Text>
          </Pressable>
        )}
      </Card>
    </Section>
  );
}

function BillRow({ bill, today, billsOn }: { bill: ListedBill; today: string; billsOn: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const due = billDay(bill.nextBillingDate);
  const days = daysBetween(today, due);
  const urgency = getUrgency(days);
  const amount = Number(bill.amount);
  const estimate = bill.amountType === 'variable';
  const missing = bill.missingPayments ?? 0;
  const amountText = `${estimate ? '~' : ''}${Number.isNaN(amount) ? bill.amount : formatCurrency(amount, bill.currency)}`;
  return (
    <Pressable
      onPress={() => router.push(`/bills/${bill.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${bill.name}, ${amountText}, ${bill.status === 'active' ? dueLabel(due, today) : bill.status}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md, backgroundColor: pressed ? colors.cardPressed : 'transparent' })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Text variant="callout" weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>{bill.name}</Text>
          {!!bill.householdId && <Users size={13} color={colors.textMuted} accessibilityLabel="Shared" />}
        </View>
        <Text variant="footnote" ink="muted" numberOfLines={1}>
          {[frequencyName(bill.billingFrequency, bill.customFrequencyDays), bill.paymentMethod ? paymentMethodLabel(bill.paymentMethod) : null, bill.category].filter(Boolean).join(' · ')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: 2 }}>
          {bill.status === 'active' && days >= 0 && (
            <Pill label={dueLabel(due, today)} tone={urgency === 'due' ? 'bad' : urgency === 'soon' ? 'warn' : 'neutral'} />
          )}
          {bill.status !== 'active' && <Pill label={bill.status === 'paused' ? 'Paused' : 'Cancelled'} tone="neutral" />}
          {billsOn && bill.kind === 'bill' && <Pill label="Bill" tone="neutral" />}
          {missing > 0 && <Pill label={`${missing} not marked paid`} tone="warn" />}
        </View>
      </View>
      <Text variant="callout" weight="semibold" ink={estimate ? 'muted' : 'primary'} tabular>{amountText}</Text>
    </Pressable>
  );
}

function AddButton({ onPress, label }: { onPress: () => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
    >
      <Plus size={26} color={colors.accent} strokeWidth={2} />
    </Pressable>
  );
}
