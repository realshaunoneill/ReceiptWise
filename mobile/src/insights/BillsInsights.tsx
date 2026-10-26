import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatCurrency } from '@shared/currency';
import { formatTotals } from '@shared/currency-totals';
import { categoryName } from '@shared/receipts/format';
import { monthlyEquivalent } from '@shared/schedule/billing-schedule';
import { monthlyTotals } from '../bills/summary';
import UpcomingPayments from '../components/UpcomingPayments';
import { useTheme } from '../contexts/ThemeContext';
import { useBills } from '../hooks/useBills';
import { radius, space } from '../theme';
import Button from '../ui/Button';
import { LoadError, Skeleton } from '../ui/Feedback';
import { Card, Section } from '../ui/Section';
import Text from '../ui/Text';

/** Paid without anyone keeping a receipt: a missing one isn't something to chase. */
const AUTOMATIC_METHODS = ['direct_debit', 'standing_order', 'card'];

/**
 * What the regular payments cost (the website's SubscriptionInsights): how many, monthly and yearly
 * per currency, receipts still to find, the biggest categories, and the next week's payments.
 */
export default function BillsInsights({ currency, billsEnabled }: { currency: string; billsEnabled: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const bills = useBills('active', undefined, true);

  if (bills.isError && !bills.data) return <LoadError message={bills.error.message} onRetry={() => void bills.refetch()} />;
  if (!bills.data) {
    return (
      <Section>
        <Card padded><View style={{ gap: space.sm }}><Skeleton width="40%" /><Skeleton height={60} /></View></Card>
      </Section>
    );
  }

  const active = bills.data.filter((bill) => bill.status === 'active');
  if (active.length === 0) {
    return (
      <Section>
        <Card padded>
          <Text variant="callout" ink="secondary">{billsEnabled ? 'No bills or subscriptions yet.' : 'No subscriptions yet.'}</Text>
        </Card>
      </Section>
    );
  }

  const monthly = monthlyTotals(active, currency);
  const yearly = monthly.map((total) => ({ ...total, amount: total.amount * 12 }));
  // Rent, loans and anything paid automatically never come with a receipt.
  const expectsReceipt = (bill: typeof active[number]) => !billsEnabled || (bill.kind !== 'bill' && !AUTOMATIC_METHODS.includes(bill.paymentMethod ?? ''));
  const missing = bills.data.filter(expectsReceipt).reduce((total, bill) => total + (bill.missingPayments ?? 0), 0);
  // Categories in your own currency only: others can't be added without rates.
  const own = active.filter((bill) => bill.currency === currency);
  const perMonth = (bill: typeof active[number]) => monthlyEquivalent(Number(bill.amount), bill.billingFrequency, bill.customFrequencyDays);
  const ownTotal = own.reduce((total, bill) => total + perMonth(bill), 0);
  const categories = Array.from(own.reduce((map, bill) => map.set(bill.category || 'Other', (map.get(bill.category || 'Other') ?? 0) + perMonth(bill)), new Map<string, number>()))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const tiles = [
    { label: 'Active', value: String(active.length) },
    { label: 'A month', value: formatTotals(monthly, currency) },
    { label: 'A year', value: formatTotals(yearly, currency) },
  ];

  return (
    <>
      <Section>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {tiles.map((tile) => (
            <View key={tile.label} accessible accessibilityLabel={`${tile.label}: ${tile.value}`} style={{ flex: 1, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 2 }}>
              <Text variant="heading" tabular numberOfLines={2} adjustsFontSizeToFit>{tile.value}</Text>
              <Text variant="caption" ink="muted">{tile.label}</Text>
            </View>
          ))}
        </View>
        {missing > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.md }}>
            <Text variant="callout" ink="warn" tabular>{missing === 1 ? '1 receipt still to find' : `${missing} receipts still to find`}</Text>
            <Button label="See them" variant="plain" size="sm" onPress={() => router.navigate('/bills')} />
          </View>
        )}
      </Section>
      {categories.length > 0 && (
        <Section title="Biggest categories">
          <Card padded>
            <View style={{ gap: space.md }}>
              {categories.map(([category, amount]) => (
                <View key={category} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                  <Text variant="callout" ink="secondary" numberOfLines={1} style={{ flex: 1 }}>{categoryName(category)}</Text>
                  <Text variant="callout" weight="medium" tabular>
                    {`${formatCurrency(amount, currency)} a month · ${ownTotal > 0 ? Math.round((amount / ownTotal) * 100) : 0}%`}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </Section>
      )}
      <UpcomingPayments bills={active} currency={currency} />
    </>
  );
}
