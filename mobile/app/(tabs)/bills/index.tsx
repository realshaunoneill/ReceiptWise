import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Plus, Repeat, Users } from 'lucide-react-native';
import { formatCurrency } from '@shared/currency';
import { formatTotals } from '@shared/currency-totals';
import { daysBetween, localToday } from '@shared/dates/local-date';
import { frequencyName, nextPaymentAmount, nextPaymentLabel, paymentMethodLabel } from '@shared/labels/subscriptions';
import { billDay, filterBills, monthlyTotals, notMarkedPaid, type KindFilter, type ListedBill } from '../../../src/bills/summary';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { useAllBills, useBills, type BillStatus } from '../../../src/hooks/useBills';
import { useMe } from '../../../src/hooks/useMe';
import { GUTTER, radius, space } from '../../../src/theme';
import Button from '../../../src/ui/Button';
import { Segmented } from '../../../src/ui/Controls';
import { EmptyState, LoadError, Notice, Pill, Skeleton } from '../../../src/ui/Feedback';
import { Card, List, Section } from '../../../src/ui/Section';
import Stale from '../../../src/ui/Stale';
import TabScreen from '../../../src/ui/TabScreen';
import { headerActions } from '../../../src/ui/HeaderButton';
import Text from '../../../src/ui/Text';

/** The All, Bills and Subscriptions switch only earns its place on a longer list. */
const KIND_FILTER_FROM = 6;

const STATUS_EMPTY: Record<BillStatus, string> = {
  active: 'Nothing active.',
  paused: 'Nothing paused. A paused bill keeps its history and expects nothing until it is resumed.',
  cancelled: 'Nothing cancelled.',
};

/**
 * Bills and subscriptions, as on the website's page: what they come to a month and a year, the
 * overdue payments, and each one by when it's next due. The totals are always the active ones,
 * whichever status is open. The status and kind switches only show once they'd change something.
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
  const all = useAllBills();
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
  // Only offered once they'd change something, or while one is in use.
  const anyStopped = (all.data ?? []).some((bill) => bill.status !== 'active');
  const showStatus = status !== 'active' || anyStopped;
  const showKind = billsOn && !nothingYet && (kind !== 'all' || activeBills.length >= KIND_FILTER_FROM);

  return (
    <TabScreen
      onRefresh={() => Promise.all([list.refetch(), active.refetch(), all.refetch()])}
    >
      <Stack.Screen options={headerActions([{ label: billsOn ? 'Add a bill or subscription' : 'Add a subscription', sfSymbol: 'plus', icon: Plus, onPress: add }])} />
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
              monthly={formatTotals(monthly, currency)}
              yearly={formatTotals(monthly.map((total) => ({ ...total, amount: total.amount * 12 })), currency)}
              missing={missing}
              onMissing={() => {
                setStatus('active');
                setMissingOnly(true);
              }}
            />
          )}

          {(showStatus || showKind) && (
          <View style={{ marginHorizontal: GUTTER, marginBottom: space.lg, gap: space.sm }}>
            {showStatus && (
              <Segmented<BillStatus>
                accessibilityLabel="Status"
                value={status}
                onChange={setStatus}
                options={[{ value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }, { value: 'cancelled', label: 'Cancelled' }]}
              />
            )}
            {showKind && (
              <Segmented<KindFilter>
                accessibilityLabel="Show bills, subscriptions or both"
                value={kind}
                onChange={setKind}
                options={[{ value: 'all', label: 'All' }, { value: 'bill', label: 'Bills' }, { value: 'subscription', label: 'Subscriptions' }]}
              />
            )}
          </View>
          )}

          {nothingYet && (
            <EmptyState
              icon={Repeat}
              title={billsOn ? 'No bills yet' : 'No subscriptions yet'}
              body={billsOn ? "Add your rent, electricity and phone, and the plan shows what's left after them." : 'Add anything that comes round again, like Netflix or your phone, and see when each is due.'}
              action={{ label: billsOn ? 'Add a bill' : 'Add a subscription', onPress: add }}
            />
          )}

          {missingOnly && (
            <Section>
              <Notice tone="warn" title="Overdue">
                {missingShown === 0
                  ? 'Nothing here is overdue.'
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

/** What the active ones come to, and the payments that are overdue (only those paid by hand). */
function Stats({ monthly, yearly, missing, onMissing }: { monthly: string; yearly: string; missing: number; onMissing: () => void }) {
  const { colors } = useTheme();
  return (
    <Section>
      <Card padded>
        <View style={{ gap: 2 }}>
          <Text variant="footnote" ink="muted">A month</Text>
          <Text variant="title" tabular adjustsFontSizeToFit numberOfLines={1}>{monthly}</Text>
          <Text variant="footnote" ink="muted" tabular>{`${yearly} a year`}</Text>
        </View>
        {missing > 0 && (
          <Pressable
            onPress={onMissing}
            accessibilityRole="button"
            accessibilityHint="Shows only those"
            style={({ pressed }) => ({ marginTop: space.lg, minHeight: 44, borderRadius: radius.md, paddingHorizontal: space.md, justifyContent: 'center', backgroundColor: pressed ? colors.cardPressed : colors.warnSoft })}
          >
            <Text variant="callout" weight="medium" ink="warn">{`${missing} overdue · Show them`}</Text>
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
  // A direct debit "goes out" and is never red; one paid by hand is "due" (shared/labels/subscriptions.ts).
  const next = nextPaymentLabel(due, today, bill.paymentMethod);
  // This month's own amount where one is set: a card bill that's usually €0 with €809 for November.
  const { amount, estimated: estimate } = nextPaymentAmount(bill);
  const missing = bill.missingPayments ?? 0;
  const amountText = `${estimate ? '~' : ''}${formatCurrency(amount, bill.currency)}`;
  return (
    <Pressable
      onPress={() => router.push(`/bills/${bill.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${bill.name}, ${amountText}, ${bill.status === 'active' ? next.label : bill.status}`}
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
            <Pill label={next.label} tone={next.urgency === 'due' ? 'bad' : next.urgency === 'soon' ? 'warn' : 'neutral'} />
          )}
          {bill.status !== 'active' && <Pill label={bill.status === 'paused' ? 'Paused' : 'Cancelled'} tone="neutral" />}
          {/* Essentials are the usual case here; only the nice-to-haves are marked. */}
          {billsOn && bill.kind !== 'bill' && <Pill label="Subscription" tone="neutral" />}
          {missing > 0 && <Pill label={`${missing} overdue`} tone="warn" />}
        </View>
      </View>
      <Text variant="callout" weight="semibold" ink={estimate ? 'muted' : 'primary'} tabular>{amountText}</Text>
    </Pressable>
  );
}

