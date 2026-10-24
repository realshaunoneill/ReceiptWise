'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTopItems } from '@/hooks/use-top-items';
import { formatCurrency } from '@/lib/utils/currency';
import { categoryName, formatDisplayDate } from '@/components/receipts/format';
import { Loader2, TrendingUp, ShoppingBag, Store, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ItemAnalysisDialog } from '@/components/insights/item-analysis-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TopItemsListProps {
  householdId?: string;
  autoLoad?: boolean;
}

export function TopItemsList({ householdId, autoLoad = false }: TopItemsListProps) {
  const [months, setMonths] = useState(12);
  const [sortBy, setSortBy] = useState<'frequency' | 'spending'>('frequency');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const { data, isLoading, error, refetch } = useTopItems({
    householdId,
    months,
    sortBy,
    limit: 20,
    enabled: autoLoad,
  });

  const handleItemClick = (itemName: string) => {
    setSelectedItem(itemName);
    setShowAnalysis(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          {/* Wraps on a phone, like the summary card beside it. */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle role="heading" aria-level={2} className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" aria-hidden="true" />
                Top items
              </CardTitle>
              <CardDescription className="mt-1.5">
                Your most frequently purchased items
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Was a native <select>, the only one in the app. */}
              <Select value={String(months)} onValueChange={(value) => setMonths(parseInt(value, 10))}>
                <SelectTrigger size="sm" className="w-full sm:w-[150px]" aria-label="Period" disabled={isLoading}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 3, 6, 12].map((period) => (
                    <SelectItem key={period} value={String(period)}>
                      {period === 1 ? 'Last month' : `Last ${period} months`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!data && !autoLoad && (
                <Button onClick={() => refetch()} disabled={isLoading} size="sm">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    'Load items'
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
              {error.message || 'An error occurred'}
            </div>
          )}

          {data && !isLoading && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3 pb-4 sm:grid-cols-3 sm:gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="amount text-xl font-bold">{data.summary.totalUniqueItems}</div>
                  <div className="text-xs text-muted-foreground">Unique items</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="amount text-xl font-bold">{data.summary.totalPurchases}</div>
                  <div className="text-xs text-muted-foreground">Total purchases</div>
                </div>
                {/* Was `{currency} {totalSpent}`: "EUR 200.1". */}
                <div className="col-span-2 text-center p-3 rounded-lg bg-muted/50 sm:col-span-1">
                  <div className="amount text-xl font-bold">
                    {formatCurrency(data.summary.totalSpent, data.summary.currency)}
                  </div>
                  <div className="text-xs text-muted-foreground">Total spent</div>
                </div>
              </div>

              {/* Sort Tabs */}
              <Tabs
                value={sortBy}
                onValueChange={(value) => setSortBy(value as 'frequency' | 'spending')}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="frequency">Most frequent</TabsTrigger>
                  <TabsTrigger value="spending">Highest spending</TabsTrigger>
                </TabsList>

                <TabsContent value={sortBy} className="mt-4">
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {/*
                      Rows were divs with onClick (no keyboard access), and the stats line
                      did not wrap: on a phone the date ran under "Avg: EUR 7.50" and pushed
                      the page sideways.
                    */}
                    {data.topItems.map((item, index) => (
                      <button
                        key={index}
                        type="button"
                        className="group flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:p-4"
                        onClick={() => handleItemClick(item.name)}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{item.name}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1 whitespace-nowrap">
                                <ShoppingBag className="h-3 w-3" aria-hidden="true" />
                                {item.count} purchase{item.count !== 1 ? 's' : ''}
                              </span>
                              <span className="flex items-center gap-1 whitespace-nowrap">
                                <Store className="h-3 w-3" aria-hidden="true" />
                                {item.merchantCount} merchant{item.merchantCount !== 1 ? 's' : ''}
                              </span>
                              {item.lastPurchased && (
                                <span className="flex items-center gap-1 whitespace-nowrap">
                                  <Calendar className="h-3 w-3" aria-hidden="true" />
                                  {formatDisplayDate(item.lastPurchased)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="amount font-semibold">
                            {formatCurrency(item.totalSpent, item.currency)}
                          </div>
                          <div className="amount text-xs text-muted-foreground whitespace-nowrap">
                            Avg {formatCurrency(item.averagePrice, item.currency)}
                          </div>
                          {item.category && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {categoryName(item.category)}
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {!data && !isLoading && !error && (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-20" aria-hidden="true" />
              <p className="text-sm">Choose &ldquo;Load items&rdquo; to see your top purchases</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Item Analysis Dialog */}
      {selectedItem && (
        <ItemAnalysisDialog
          itemName={selectedItem}
          open={showAnalysis}
          onOpenChange={(open) => {
            setShowAnalysis(open);
            if (!open) {
              setSelectedItem(null);
            }
          }}
          householdId={householdId}
        />
      )}
    </>
  );
}
