import React from 'react';
import { View } from 'react-native';
import { type WireReceiptStats } from '@shared/api/insights';
import { formatCurrency } from '@shared/currency';
import { categoryName } from '@shared/receipts/format';
import { space } from '../theme';
import { Card } from '../ui/Section';
import Text from '../ui/Text';

/**
 * Four figures for the view, named for what they are (the website's QuickStats): the receipts,
 * the lines read off them, the average receipt (not a daily figure), and where most went.
 */
export default function QuickStats({ stats, currency }: { stats: WireReceiptStats; currency: string }) {
  const tiles = [
    { label: 'Receipts', value: String(stats.totalReceipts), detail: 'In this view' },
    { label: 'Line items', value: String(stats.totalItems), detail: 'Read off those receipts' },
    { label: 'Average receipt', value: formatCurrency(stats.avgSpending, currency), detail: 'Total over receipts' },
    { label: 'Top category', value: stats.spendingByCategory[0] ? categoryName(stats.spendingByCategory[0].category) : 'None yet', detail: 'Where most went' },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
      {tiles.map((tile) => (
        <Card key={tile.label} padded style={{ flexGrow: 1, flexBasis: '45%' }}>
          <View accessible accessibilityLabel={`${tile.label}: ${tile.value}. ${tile.detail}`} style={{ gap: 2 }}>
            <Text variant="footnote" ink="muted">{tile.label}</Text>
            <Text variant="title" tabular numberOfLines={1} adjustsFontSizeToFit>{tile.value}</Text>
            <Text variant="caption" ink="muted">{tile.detail}</Text>
          </View>
        </Card>
      ))}
    </View>
  );
}
