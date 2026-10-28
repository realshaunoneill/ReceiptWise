import React from 'react';
import { View } from 'react-native';
import { type WireReceiptStats } from '@shared/api/insights';
import { formatCurrency } from '@shared/currency';
import { quickStatTiles } from '@shared/insights/quick-stats';
import { space } from '../theme';
import { Card } from '../ui/Section';
import Text from '../ui/Text';

/**
 * Three figures for the view, the same as the website's dashboard (shared/insights/quick-stats.ts):
 * the receipts (and how many this month), the average receipt, and where most went.
 */
export default function QuickStats({ stats, currency, receiptsThisMonth }: { stats: WireReceiptStats; currency: string; receiptsThisMonth: number | null }) {
  const tiles = quickStatTiles(stats, receiptsThisMonth, (amount) => formatCurrency(amount, currency));
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
      {tiles.map((tile) => (
        <Card key={tile.key} padded style={{ flexGrow: 1, flexBasis: '45%' }}>
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
