import React, { useState } from 'react';
import { View } from 'react-native';
import { TrendingDown, TrendingUp } from 'lucide-react-native';
import { formatCurrency } from '@shared/currency';
import { localToday } from '@shared/dates/local-date';
import { categoryName } from '@shared/receipts/format';
import { useTheme } from '../contexts/ThemeContext';
import { useReceiptStats } from '../hooks/useInsights';
import { space } from '../theme';
import BarChart from '../ui/BarChart';
import { Segmented } from '../ui/Controls';
import { Skeleton } from '../ui/Feedback';
import { Card } from '../ui/Section';
import Text from '../ui/Text';
import { describeTrends, periodBounds, spendingTrends, type TrendPeriod } from './trends';

const PERIOD_LABEL: Record<TrendPeriod, string> = { week: 'Last 7 days', month: 'This month', year: 'This year' };

/**
 * Total spending for the week, month or year, against the period before; where it went, as bars
 * over time and by category (the website's SpendingSummary and SpendingChart, as one card).
 * Spending more is shown in red and less in green, as on the website.
 */
export default function SpendingSummary({ householdId, currency }: { householdId?: string; currency: string }) {
  const { colors } = useTheme();
  const [period, setPeriod] = useState<TrendPeriod>('month');
  const today = localToday();
  const stats = useReceiptStats(householdId, periodBounds(period, today).previousStart);
  const trends = stats.data ? spendingTrends(stats.data.points ?? [], period, today) : null;
  const money = (amount: number) => formatCurrency(amount, currency);
  const up = (trends?.change ?? 0) > 0;
  const Trend = up ? TrendingUp : TrendingDown;

  return (
    <Card padded>
      <View style={{ gap: space.lg }}>
        <Segmented<TrendPeriod>
          accessibilityLabel="Period"
          value={period}
          onChange={setPeriod}
          options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }]}
        />
        {!trends ? (
          <View style={{ gap: space.sm }}>
            <Skeleton width="35%" />
            <Skeleton width="55%" height={32} />
            <Skeleton height={120} />
          </View>
        ) : trends.total === 0 ? (
          <View style={{ gap: space.xs }}>
            <Text variant="footnote" ink="muted">{PERIOD_LABEL[period]}</Text>
            <Text variant="callout" ink="secondary">{`Nothing spent ${period === 'week' ? 'in the last 7 days' : period === 'month' ? 'this month' : 'this year'} yet.`}</Text>
          </View>
        ) : (
          <>
            <View style={{ gap: 2 }}>
              <Text variant="footnote" ink="muted">{PERIOD_LABEL[period]}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' }}>
                <Text variant="largeTitle" tabular>{money(trends.total)}</Text>
                {trends.change !== 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessible accessibilityLabel={`${up ? 'Up' : 'Down'} ${Math.abs(trends.change)}% on the period before`}>
                    <Trend size={15} color={up ? colors.bad : colors.good} />
                    <Text variant="footnote" weight="semibold" ink={up ? 'bad' : 'good'} tabular>{`${Math.abs(trends.change)}%`}</Text>
                  </View>
                )}
              </View>
            </View>
            <BarChart bars={trends.bars} format={money} summary={describeTrends(trends, period, money)} />
            {trends.byCategory.length > 0 && (
              <View style={{ gap: space.md }}>
                <Text variant="label" accessibilityRole="header">By category</Text>
                {trends.byCategory.slice(0, 5).map((row) => (
                  <View key={row.category} style={{ gap: 6 }} accessible accessibilityLabel={`${categoryName(row.category)}, ${money(row.amount)}, ${row.percentage}%`}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                      <Text variant="footnote" ink="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>{categoryName(row.category)}</Text>
                      <Text variant="footnote" weight="medium" tabular>{money(row.amount)}</Text>
                    </View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.field, overflow: 'hidden' }}>
                      <View style={{ width: `${row.percentage}%`, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
                    </View>
                  </View>
                ))}
                {trends.byCategory.length > 5 && (
                  <Text variant="caption" ink="muted">{`+${trends.byCategory.length - 5} more ${trends.byCategory.length - 5 === 1 ? 'category' : 'categories'}`}</Text>
                )}
              </View>
            )}
          </>
        )}
      </View>
    </Card>
  );
}
