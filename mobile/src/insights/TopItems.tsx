import React, { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatCurrency } from '@shared/currency';
import { formatTotals } from '@shared/currency-totals';
import { formatDisplayDate } from '@shared/receipts/format';
import { useTheme } from '../contexts/ThemeContext';
import { useTopItems } from '../hooks/useInsights';
import { radius, space } from '../theme';
import { Segmented } from '../ui/Controls';
import { LoadError } from '../ui/Feedback';
import { Card, List, Section } from '../ui/Section';
import Text from '../ui/Text';

type Sort = 'frequency' | 'spending';

/**
 * What you buy most, by how often or by how much (the website's TopItemsList), over the Overview's
 * period; each opens its history.
 */
export default function TopItems({ householdId, months }: { householdId?: string; months: number }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [sortBy, setSortBy] = useState<Sort>('frequency');
  const top = useTopItems(householdId, months, sortBy);
  const data = top.data;
  const money = (amount: number, currency?: string) => formatCurrency(amount, currency ?? data?.summary.currency ?? 'EUR');

  return (
    <Section title="Top items" footer="What you buy most often, or spend most on, read off your receipts.">
      <View style={{ gap: space.md, marginBottom: space.md }}>
        <Segmented<Sort> accessibilityLabel="Order" value={sortBy} onChange={setSortBy} options={[{ value: 'frequency', label: 'Most frequent' }, { value: 'spending', label: 'Highest spending' }]} />
      </View>
      {top.isError && !data ? (
        <LoadError message={top.error.message} onRetry={() => void top.refetch()} />
      ) : !data ? (
        <ActivityIndicator color={colors.textMuted} style={{ margin: space.xxl }} />
      ) : data.topItems.length === 0 ? (
        <Card padded><Text variant="callout" ink="secondary">Nothing bought in this period. Try a longer one.</Text></Card>
      ) : (
        <View style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {[
              { label: 'Different items', value: String(data.summary.totalUniqueItems) },
              { label: 'Purchases', value: String(data.summary.totalPurchases) },
              // Per currency ("€463.99 + $125.51"): it added euro and dollars up under one sign.
              { label: 'Total spent', value: formatTotals(data.summary.totals ?? [{ currency: data.summary.currency, amount: data.summary.totalSpent }], data.summary.currency) },
            ].map((tile) => (
              <View key={tile.label} accessible accessibilityLabel={`${tile.label}: ${tile.value}`} style={{ flex: 1, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 2 }}>
                <Text variant="heading" tabular numberOfLines={1} adjustsFontSizeToFit>{tile.value}</Text>
                <Text variant="caption" ink="muted">{tile.label}</Text>
              </View>
            ))}
          </View>
          <List inset={60}>
            {data.topItems.map((item, index) => (
              <Pressable
                key={`${item.name}-${index}`}
                onPress={() => router.push({ pathname: '/items/[name]', params: { name: item.name, ...(householdId ? { householdId } : {}) } })}
                accessibilityRole="button"
                accessibilityLabel={`${index + 1}. ${item.name}, ${item.count} purchases, ${money(item.totalSpent, item.currency)}`}
                accessibilityHint="See this item's history"
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56, backgroundColor: pressed ? colors.cardPressed : 'transparent' })}
              >
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Text variant="caption" ink="accent" tabular>{String(index + 1)}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="callout" weight="medium" numberOfLines={1}>{item.name}</Text>
                  <Text variant="footnote" ink="muted" numberOfLines={1}>
                    {[
                      item.count === 1 ? '1 purchase' : `${item.count} purchases`,
                      item.merchantCount === 1 ? '1 shop' : `${item.merchantCount} shops`,
                      item.lastPurchased ? formatDisplayDate(item.lastPurchased) : null,
                    ].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <Text variant="callout" weight="semibold" tabular>{money(item.totalSpent, item.currency)}</Text>
                  <Text variant="caption" ink="muted" tabular>{`~${money(item.averagePrice, item.currency)} each`}</Text>
                </View>
              </Pressable>
            ))}
          </List>
        </View>
      )}
    </Section>
  );
}
