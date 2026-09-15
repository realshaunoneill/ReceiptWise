'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Receipt, ShoppingBag, Tag, Wallet } from 'lucide-react';
import { useCurrency } from '@/lib/hooks/use-currency';
import { getCategory } from '@/lib/utils/categories';

interface QuickStatsProps {
  stats: {
    totalReceipts: number
    totalItems: number
    avgSpending: number
    topCategory: string
  }
}

/*
 * Four figures across the top of the dashboard.
 *
 * Two things were wrong here beyond the styling. Each tile carried its own hue —
 * blue, emerald, violet, amber — which made four unrelated numbers look like four
 * unrelated features; and the labels described data the tiles were not being
 * given. "Daily Average / Past 30 days" was fed `totalSpent / receiptCount`, the
 * mean per *receipt* over however many receipts exist. "Total Receipts / Uploaded
 * this month" was fed an all-time count, not a monthly one. And "Items Tracked /
 * Individual purchases" was handed the receipt count a second time, so the first
 * two tiles always showed the identical number under different names.
 *
 * The labels below say what the numbers are.
 */
const statConfig = [
  {
    key: 'totalReceipts',
    label: 'Receipts',
    icon: Receipt,
    description: 'In this view',
  },
  {
    key: 'totalItems',
    label: 'Line items',
    icon: ShoppingBag,
    description: 'Read off those receipts',
  },
  {
    key: 'avgSpending',
    label: 'Average receipt',
    icon: Wallet,
    description: 'Total divided by receipts',
    isCurrency: true,
  },
  {
    key: 'topCategory',
    label: 'Top category',
    icon: Tag,
    description: 'By amount spent',
    isCategory: true,
  },
] as const;

export function QuickStats({ stats }: QuickStatsProps) {
  const { format: formatCurrency } = useCurrency();

  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
      {statConfig.map((stat) => {
        const Icon = stat.icon;
        const raw = stats[stat.key as keyof QuickStatsProps['stats']];

        let value: string;
        if ('isCurrency' in stat && stat.isCurrency) {
          value = formatCurrency(Number(raw) || 0);
        } else if ('isCategory' in stat && stat.isCategory) {
          // 'No data' is the hook's sentinel when there are no receipts; it is not
          // a category, so it must not be run through the category table.
          value = raw === 'No data' ? '—' : getCategory(String(raw)).label;
        } else {
          value = new Intl.NumberFormat().format(Number(raw) || 0);
        }

        return (
          <Card key={stat.key} className="transition-colors hover:border-primary/30">
            <CardContent className="px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="amount truncate text-2xl font-semibold tracking-tight text-foreground">
                    {value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
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
