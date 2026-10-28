'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Receipt, Tag, Wallet } from 'lucide-react';
import { useCurrency } from '@/lib/hooks/use-currency';
import { quickStatTiles, type QuickStatTile } from '@/shared/insights/quick-stats';

interface QuickStatsProps {
  stats: {
    totalReceipts: number
    avgSpending: number
    spendingByCategory: Array<{ category: string }>
    currency?: string
    otherCurrencies?: Array<{ currency: string; receipts: number }>
  }
  /** Completed receipts dated this calendar month, or null while unknown. */
  receiptsThisMonth: number | null
}

const ICON: Record<QuickStatTile['key'], typeof Receipt> = { receipts: Receipt, average: Wallet, category: Tag };

/*
 * Three figures across the top of the dashboard, the same as the app's Home (shared/insights/
 * quick-stats.ts). There were four: "Line items · Read off those receipts" and "Average receipt ·
 * Total divided by receipts" explained arithmetic rather than saying anything.
 */
export function QuickStats({ stats, receiptsThisMonth }: QuickStatsProps) {
  const { format: formatCurrency } = useCurrency();
  const tiles = quickStatTiles(stats, receiptsThisMonth, formatCurrency);

  return (
    // Two across on a phone with the third full width; three across from sm.
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      {tiles.map((tile, index) => {
        const Icon = ICON[tile.key];
        return (
          <Card key={tile.key} className={index === tiles.length - 1 ? 'col-span-2 sm:col-span-1' : undefined}>
            <CardContent className="px-4 sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{tile.label}</p>
                  <p className="amount truncate text-2xl font-semibold tracking-tight text-foreground">{tile.value}</p>
                  <p className="text-xs text-muted-foreground">{tile.detail}</p>
                </div>
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
