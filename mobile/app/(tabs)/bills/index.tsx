import React from 'react';
import { View } from 'react-native';
import { Repeat } from 'lucide-react-native';
import { formatCurrency } from '@shared/currency';
import { daysBetween, formatLocalDate, localToday } from '@shared/dates/local-date';
import { frequencyName, paymentMethodLabel } from '@shared/labels/subscriptions';
import { getUrgency } from '@shared/urgency';
import { useBills } from '../../../src/hooks/useBills';
import { useMe } from '../../../src/hooks/useMe';
import { GUTTER, radius, space } from '../../../src/theme';
import { EmptyState, LoadError, Notice, Pill, Skeleton } from '../../../src/ui/Feedback';
import { List, Section } from '../../../src/ui/Section';
import TabScreen from '../../../src/ui/TabScreen';
import Text from '../../../src/ui/Text';
import { type WireBill } from '@shared/api/bills';

/** "Today", "Tomorrow", "In 3 days" within a week, then the date (DESIGN.md). */
function dueLabel(day: string, today: string): string {
  const days = daysBetween(today, day);
  if (days < 0) return `Was due ${formatLocalDate(day, { day: 'numeric', month: 'short' }, 'en-IE')}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days < 7) return `Due in ${days} days`;
  return `Due ${formatLocalDate(day, { day: 'numeric', month: 'short' }, 'en-IE')}`;
}

/** Bills and subscriptions, soonest first. Adding and changing them comes to the app next. */
export default function Bills() {
  const me = useMe();
  const bills = useBills('active');
  const today = localToday();

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

  return (
    <TabScreen onRefresh={() => void bills.refetch()} refreshing={bills.isRefetching}>
      {bills.isPending ? (
        <View style={{ marginHorizontal: GUTTER, gap: space.md }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} height={60} round={radius.lg} />)}
        </View>
      ) : bills.isError ? (
        <LoadError message={bills.error.message} onRetry={() => void bills.refetch()} />
      ) : bills.data.length === 0 ? (
        <EmptyState icon={Repeat} title="No bills yet" body="Add your bills on the website for now, and they show up here with when each is due." />
      ) : (
        <Section>
          <List>{bills.data.map((bill) => <BillRow key={bill.id} bill={bill} today={today} />)}</List>
        </Section>
      )}
    </TabScreen>
  );
}

function BillRow({ bill, today }: { bill: WireBill; today: string }) {
  const due = bill.nextBillingDate.slice(0, 10);
  const urgency = getUrgency(daysBetween(today, due));
  const amount = Number(bill.amount);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="semibold" numberOfLines={1}>{bill.name}</Text>
        <Text variant="footnote" ink="muted" numberOfLines={1}>
          {[frequencyName(bill.billingFrequency, bill.customFrequencyDays), bill.paymentMethod ? paymentMethodLabel(bill.paymentMethod) : null].filter(Boolean).join(' · ')}
        </Text>
        <View style={{ marginTop: 2 }}>
          <Pill label={dueLabel(due, today)} tone={urgency === 'due' ? 'bad' : urgency === 'soon' ? 'warn' : 'neutral'} />
        </View>
      </View>
      <Text variant="callout" weight="semibold" ink={bill.amountType === 'variable' ? 'muted' : 'primary'} tabular>
        {`${bill.amountType === 'variable' ? '~' : ''}${Number.isNaN(amount) ? bill.amount : formatCurrency(amount, bill.currency)}`}
      </Text>
    </View>
  );
}
