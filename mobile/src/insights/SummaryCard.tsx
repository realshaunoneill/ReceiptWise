import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { FileText } from 'lucide-react-native';
import { formatCurrency } from '@shared/currency';
import { categoryName } from '@shared/receipts/format';
import { useTheme } from '../contexts/ThemeContext';
import { useSpendingSummary } from '../hooks/useInsights';
import { radius, space } from '../theme';
import Button from '../ui/Button';
import { Segmented } from '../ui/Controls';
import { Notice } from '../ui/Feedback';
import { Card } from '../ui/Section';
import Text from '../ui/Text';
import SummaryText from './SummaryText';

const PERIODS = ['1', '3', '6', '12'] as const;
type Months = typeof PERIODS[number];

/**
 * A written read on the period picked (the website's SpendingSummaryCard). It's one AI call per
 * period, so it's only written when asked for; once written it shows again for the visit, and the
 * server keeps it a day. Changing the period doesn't write a new one by itself.
 */
export default function SummaryCard({ householdId }: { householdId?: string }) {
  const { colors } = useTheme();
  const [months, setMonths] = useState<Months>('3');
  const key = `${householdId ?? ''}|${months}`;
  const [asked, setAsked] = useState<string | null>(null);
  const summary = useSpendingSummary(householdId, Number(months), asked === key);
  const statistics = summary.data?.data?.statistics;
  const money = (amount: number) => formatCurrency(amount, statistics?.currency ?? 'EUR');
  const lists = summary.data?.data
    ? [
      { title: 'Top items', rows: summary.data.data.topItems.slice(0, 5).map((item) => ({ label: item.name, value: `${item.count}×` })) },
      { title: 'Top categories', rows: summary.data.data.topCategories.slice(0, 5).map((row) => ({ label: categoryName(row.category), value: money(row.total) })) },
      { title: 'Top shops', rows: summary.data.data.topMerchants.slice(0, 5).map((row) => ({ label: row.merchant, value: money(row.total) })) },
    ]
    : [];

  return (
    <Card padded>
      <View style={{ gap: space.lg }}>
        <View style={{ gap: 2 }}>
          <Text variant="heading" accessibilityRole="header">Spending summary</Text>
          <Text variant="footnote" ink="muted">A written read on the period you pick</Text>
        </View>
        <Segmented<Months>
          accessibilityLabel="Period"
          value={months}
          onChange={setMonths}
          options={PERIODS.map((value) => ({ value, label: value === '1' ? 'Last month' : `${value} months` }))}
        />
        {summary.isFetching && !summary.data ? (
          <View style={{ alignItems: 'center', paddingVertical: space.xxl, gap: space.md }} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.textMuted} />
            <Text variant="footnote" ink="muted">Reading through your receipts…</Text>
          </View>
        ) : summary.isError ? (
          <View style={{ gap: space.md }}>
            <Notice tone="bad" title="The summary couldn't be written just now" />
            <Button label="Try again" variant="secondary" onPress={() => void summary.refetch()} />
          </View>
        ) : summary.data ? (
          <View style={{ gap: space.lg }}>
            <SummaryText markdown={summary.data.summary} />
            {/* A period with no receipts comes back as the sentence alone. */}
            {!!statistics && (
              <>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  {[
                    { label: 'Items bought', value: String(statistics.totalItems) },
                    { label: 'Total spent', value: money(statistics.totalSpent) },
                    { label: 'Per item', value: money(statistics.averagePerItem) },
                  ].map((tile) => (
                    <View key={tile.label} accessible accessibilityLabel={`${tile.label}: ${tile.value}`} style={{ flex: 1, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.field, gap: 2 }}>
                      <Text variant="heading" tabular numberOfLines={1} adjustsFontSizeToFit>{tile.value}</Text>
                      <Text variant="caption" ink="muted">{tile.label}</Text>
                    </View>
                  ))}
                </View>
                {lists.filter((list) => list.rows.length > 0).map((list) => (
                  <View key={list.title} style={{ gap: space.sm }}>
                    <Text variant="label" accessibilityRole="header">{list.title}</Text>
                    {list.rows.map((row, index) => (
                      <View key={`${row.label}-${index}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                        <Text variant="footnote" ink="secondary" numberOfLines={1} style={{ flex: 1 }}>{row.label}</Text>
                        <Text variant="footnote" weight="medium" tabular>{row.value}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </>
            )}
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.lg }}>
            <FileText size={32} color={colors.textMuted} />
            <Text variant="callout" ink="secondary" align="center">A few paragraphs on where the money went in this period, and what you buy most.</Text>
            <Button label="Write a summary" icon={FileText} onPress={() => setAsked(key)} style={{ alignSelf: 'stretch' }} />
          </View>
        )}
      </View>
    </Card>
  );
}
