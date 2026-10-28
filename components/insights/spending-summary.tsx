'use client';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { localToday } from '@/lib/dates/local-date';
import { useSpendingTrends } from '@/lib/hooks/use-spending-trends';
import { useCurrency } from '@/lib/hooks/use-currency';
import { getCategory } from '@/lib/utils/categories';
import { nothingSpentLine } from '@/shared/insights/quick-stats';

interface SpendingSummaryProps {
  period: 'week' | 'month' | 'year'
  onPeriodChange: (period: 'week' | 'month' | 'year') => void
  householdId?: string
  personalOnly?: boolean
  /** The newest receipt's date, for "Nothing this month yet. Your last receipt was 7 Jan." */
  lastReceipt?: string | null
}

const PERIOD_LABEL = {
  week: 'Last 7 days',
  month: 'This month',
  year: 'This year',
};

export function SpendingSummary({ period, onPeriodChange, householdId, personalOnly = false, lastReceipt = null }: SpendingSummaryProps) {
  const { data: trendsData, isLoading, error } = useSpendingTrends(householdId, period, personalOnly);
  const { format: formatCurrency } = useCurrency();
  const empty = !isLoading && !error && (!trendsData || trendsData.totalSpent === 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle role="heading" aria-level={2} className="text-xl sm:text-2xl">Total spending</CardTitle>
            <CardDescription>{PERIOD_LABEL[period]}</CardDescription>
          </div>
          <Tabs value={period} onValueChange={(v) => onPeriodChange(v as 'week' | 'month' | 'year')}>
            <TabsList className="grid w-full grid-cols-3 sm:w-auto">
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="year">Year</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex h-[200px] items-center justify-center" role="status">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="mt-4 text-sm text-muted-foreground">Loading spending…</p>
            </div>
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-destructive">Spending didn&apos;t load. Refresh the page to try again.</p>
        ) : empty || !trendsData ? (
          // Someone with receipts, just none in this period: one line, not "upload receipts".
          <div className="flex items-center gap-3 py-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <Wallet className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="text-sm text-muted-foreground">{nothingSpentLine(period, lastReceipt, localToday())}</p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">
                {formatCurrency(trendsData.totalSpent)}
              </span>
              {trendsData.change !== 0 && (
                <div
                  className={`flex items-center gap-1 text-sm font-medium ${trendsData.change >= 0 ? 'text-destructive' : 'text-primary'}`}
                  title="Against the same number of days before"
                >
                  {trendsData.change >= 0 ? <TrendingUp className="h-4 w-4" aria-hidden="true" /> : <TrendingDown className="h-4 w-4" aria-hidden="true" />}
                  <span className="sr-only">{trendsData.change >= 0 ? 'Up' : 'Down'}</span>
                  {Math.round(Math.abs(trendsData.change))}%
                </div>
              )}
            </div>

            {trendsData.spendingByCategory.length > 0 && (
              <div className="space-y-3">
                {/* Was an h4 straight under the page's h1; the card title above is now its h2. */}
                <h3 className="text-sm font-semibold text-foreground">By category</h3>
                <div className="space-y-3">
                  {trendsData.spendingByCategory.slice(0, 5).map((item) => (
                    <div key={item.category} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        {/* Was the raw key, so fuel read "Gas". */}
                        <span className="text-muted-foreground">{getCategory(item.category).label}</span>
                        <span className="font-medium text-foreground">{formatCurrency(item.amount)}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {trendsData.spendingByCategory.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      +{trendsData.spendingByCategory.length - 5} more categories
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
