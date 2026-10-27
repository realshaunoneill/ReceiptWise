import React from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { formatCurrency } from '@shared/currency';
import { formatDisplayDate } from '@shared/receipts/format';
import { useTheme } from '../../../../src/contexts/ThemeContext';
import { useItemAnalysis } from '../../../../src/hooks/useInsights';
import { useMe } from '../../../../src/hooks/useMe';
import { GUTTER, radius, space } from '../../../../src/theme';
import { EmptyState, LoadError, Skeleton } from '../../../../src/ui/Feedback';
import Row from '../../../../src/ui/Row';
import { List, Section } from '../../../../src/ui/Section';
import TabScreen from '../../../../src/ui/TabScreen';
import Text from '../../../../src/ui/Text';

/** One item over the past year (the website's ItemAnalysisDialog): the totals, its kinds, where it was bought, the receipts. */
export default function ItemScreen() {
  const { name = '', householdId } = useLocalSearchParams<{ name: string; householdId?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const me = useMe();
  const analysis = useItemAnalysis(name, householdId, me.data?.currency ?? 'EUR');
  const data = analysis.data;
  const money = (amount: number, currency?: string) => formatCurrency(amount, currency ?? data?.totals.currency ?? 'EUR');

  return (
    <>
      <Stack.Screen options={{ title: data?.title ?? name }} />
      <TabScreen onRefresh={() => analysis.refetch()}>
        {analysis.isPending ? (
          <View style={{ marginHorizontal: GUTTER, gap: space.lg }}>
            <Skeleton height={80} round={radius.lg} />
            <Skeleton height={160} round={radius.lg} />
          </View>
        ) : analysis.isError ? (
          <LoadError message={analysis.error.message} onRetry={() => void analysis.refetch()} />
        ) : !data ? (
          <EmptyState icon={SearchX} title={`No "${name}" in the past year`} body="Nothing on your receipts matches it. Try a shorter name, like the first word of it." />
        ) : (
          <>
            <Section>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {[
                  { label: 'Purchases', value: String(data.totals.purchases), detail: `${data.totals.quantity.toFixed(1)} in all` },
                  { label: 'Spent', value: money(data.totals.spent), detail: 'Past 12 months' },
                  { label: 'Average', value: money(data.totals.averagePrice), detail: 'Each purchase' },
                  { label: 'Shops', value: String(data.merchants.length), detail: data.merchants[0] ? `Mostly ${data.merchants[0].merchant}` : 'None named' },
                ].map((tile) => (
                  <View key={tile.label} accessible accessibilityLabel={`${tile.label}: ${tile.value}. ${tile.detail}`} style={{ flexGrow: 1, flexBasis: '45%', padding: space.md, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, gap: 2 }}>
                    <Text variant="footnote" ink="muted">{tile.label}</Text>
                    <Text variant="title" tabular numberOfLines={1} adjustsFontSizeToFit>{tile.value}</Text>
                    <Text variant="caption" ink="muted" numberOfLines={1}>{tile.detail}</Text>
                  </View>
                ))}
              </View>
            </Section>

            {data.variants.length > 1 && (
              <Section title="Kinds of it">
                <List>
                  {data.variants.map((variant) => (
                    <Row key={variant.name} label={variant.name} detail={`${variant.count === 1 ? '1 purchase' : `${variant.count} purchases`} · ~${money(variant.averagePrice)} each`} value={money(variant.totalSpent)} />
                  ))}
                </List>
              </Section>
            )}

            {data.merchants.length > 0 && (
              <Section title="Where">
                <List>
                  {data.merchants.map((merchant) => (
                    <Row key={merchant.merchant} label={merchant.merchant} detail={`${merchant.count === 1 ? '1 purchase' : `${merchant.count} purchases`} · ~${money(merchant.average)} each`} value={money(merchant.total)} />
                  ))}
                </List>
              </Section>
            )}

            {data.purchases.length > 0 && (
              <Section title="Recent receipts">
                <List>
                  {data.purchases.map((purchase) => (
                    <Row
                      key={purchase.receiptId}
                      label={purchase.merchant}
                      detail={[purchase.date ? formatDisplayDate(purchase.date) : null, purchase.itemCount > 1 ? `${purchase.itemCount} lines` : null].filter(Boolean).join(' · ')}
                      value={money(Number(purchase.price), purchase.currency)}
                      onPress={() => router.push({ pathname: '/receipts/[id]', params: { id: purchase.receiptId } })}
                    />
                  ))}
                </List>
              </Section>
            )}
          </>
        )}
      </TabScreen>
    </>
  );
}
