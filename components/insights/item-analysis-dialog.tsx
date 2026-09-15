'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useItemAnalysis } from '@/hooks/use-item-analysis';
import { useCurrency } from '@/lib/hooks/use-currency';
import { Loader2, TrendingUp, ShoppingCart, Calendar, Store, ShoppingBag, AlertCircle, RefreshCcw, ExternalLink, Receipt, ImageIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ReceiptDetailModal } from '@/components/receipts/receipt-detail-modal';
import type { ReceiptWithItems } from '@/lib/types/api-responses';

interface ItemAnalysisDialogProps {
  itemName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId?: string;
}

export function ItemAnalysisDialog({
  itemName,
  open,
  onOpenChange,
  householdId,
}: ItemAnalysisDialogProps) {
  const [months] = useState(12);
  const router = useRouter();
  const { currency: userCurrency } = useCurrency();
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptWithItems | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);

  const { data: analysis, isLoading, error, refetch } = useItemAnalysis({
    itemName,
    householdId,
    months,
    enabled: open && !!itemName,
    userCurrency,
  });

  const handleRefresh = () => {
    refetch();
  };

  const handleViewReceipt = async (receiptId: string) => {
    setIsLoadingReceipt(true);
    try {
      const response = await fetch(`/api/receipts/${receiptId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch receipt');
      }
      const receipt = await response.json();
      setSelectedReceipt(receipt);
      setIsReceiptModalOpen(true);
    } catch (error) {
      console.error('Error fetching receipt:', error);
      // Fallback to navigation if fetch fails
      router.push(`/receipts?receiptId=${receiptId}`);
    } finally {
      setIsLoadingReceipt(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 overflow-hidden border-0"
        style={{
          maxWidth: '1200px',
          width: '90vw',
          maxHeight: '90vh',
          height: '90vh',
        }}
      >
        <div className="h-full overflow-y-auto p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <TrendingUp className="h-6 w-6" />
              Spending Analysis: {itemName}
            </DialogTitle>
            <DialogDescription className="text-base">
              View your spending patterns for this item over time
            </DialogDescription>
          </DialogHeader>

          {isLoading && (
            <div className="space-y-6 animate-in fade-in-50 duration-300">
              {/* Loading message */}
              <div className="flex items-center justify-center gap-3 py-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Analyzing your spending patterns...</span>
              </div>

              {/* Summary Cards Skeleton */}
              <div className="grid gap-4 md:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-20 mb-2" />
                      <Skeleton className="h-3 w-32" />
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Item Variants Skeleton */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-5 w-28" />
                  </div>
                  <Skeleton className="h-4 w-40 mt-1" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="p-3 rounded-lg border space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                          <div className="text-right space-y-2">
                            <Skeleton className="h-4 w-16 ml-auto" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Merchants Skeleton */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                  <Skeleton className="h-4 w-64 mt-1" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-8 w-8 rounded-full" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                        <Skeleton className="h-5 w-16" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {error && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Unable to Load Analysis
                </CardTitle>
                <CardDescription>
                  We couldn't retrieve spending data for this item
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md bg-background/50 p-4 space-y-2">
                  <p className="text-sm font-medium">Error Details:</p>
                  <p className="text-sm text-muted-foreground">
                    {error.message || 'An unexpected error occurred'}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Possible reasons:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>This item hasn't been purchased in the selected time period</li>
                    <li>The item name doesn't match any records in your receipts</li>
                    <li>There may be a temporary connection issue</li>
                  </ul>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleRefresh}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Try Again
                  </Button>
                  <Button
                    onClick={() => onOpenChange(false)}
                    variant="secondary"
                    size="sm"
                  >
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {analysis && !isLoading && (
            <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Total Purchases
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analysis.summary.totalPurchases}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analysis.summary.totalQuantity.toFixed(1)} items total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analysis.summary.currency} {analysis.summary.totalSpent.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Avg: {analysis.summary.currency} {analysis.summary.averagePrice.toFixed(2)} per purchase
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Time Period
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analysis.searchPeriod.months} months</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(analysis.searchPeriod.startDate).toLocaleDateString()} - {new Date(analysis.searchPeriod.endDate).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>

              {analysis.recentPurchases.length >= 2 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Price Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const latestPrice = parseFloat(analysis.recentPurchases[0].price);
                      const previousPrice = parseFloat(analysis.recentPurchases[1].price);
                      const priceDiff = latestPrice - previousPrice;
                      const percentChange = ((priceDiff / previousPrice) * 100);
                      const isIncreasing = priceDiff > 0;
                      const isStable = Math.abs(percentChange) < 1;

                      return (
                        <>
                          <div className={`amount text-2xl font-semibold ${isStable ? 'text-muted-foreground' : isIncreasing ? 'text-destructive' : 'text-success'}`}>
                            {isStable ? '~' : isIncreasing ? '↑' : '↓'} {Math.abs(percentChange).toFixed(1)}%
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {isStable ? 'Stable' : isIncreasing ? 'Increasing' : 'Decreasing'} vs. last purchase
                          </p>
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Item Variants */}
            {analysis.itemVariants && analysis.itemVariants.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5" />
                    Item Variants
                  </CardTitle>
                  <CardDescription>
                    {analysis.itemVariants.length === 1
                      ? 'Single item found'
                      : `${analysis.itemVariants.length} related items found`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis.itemVariants.map((variant, index) => (
                      <div key={index} className="p-3 rounded-lg border space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{variant.name}</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {variant.count} purchase{variant.count !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="font-semibold">
                              {analysis.summary.currency} {variant.totalSpent.toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Avg: {analysis.summary.currency} {variant.averagePrice.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        {variant.merchants && variant.merchants.length > 0 && (
                          <div className="flex items-center gap-2 pt-2 border-t">
                            <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div className="text-xs text-muted-foreground truncate">
                              {variant.merchants.join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Merchants */}
            {analysis.topMerchants.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5" />
                    Top Merchants
                  </CardTitle>
                  <CardDescription>Where you've purchased these items most frequently</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis.topMerchants.map((merchant, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{merchant.merchant}</div>
                            <div className="text-sm text-muted-foreground">
                              {merchant.count} purchase{merchant.count !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            {analysis.summary.currency} {merchant.total.toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Avg: {analysis.summary.currency} {merchant.average.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}



            {/* Recent Purchases */}
            {analysis.recentPurchases.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Recent Purchases
                  </CardTitle>
                  <CardDescription>
                    {analysis.recentPurchases.length} recent purchase{analysis.recentPurchases.length !== 1 ? 's' : ''} of this item
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analysis.recentPurchases.map((purchase, index) => (
                      <div
                        key={purchase.receiptId || index}
                        className="group relative p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          {/* Receipt Thumbnail */}
                          {purchase.imageUrl ? (
                            <div 
                              className="shrink-0 w-16 h-20 sm:w-20 sm:h-24 rounded-md overflow-hidden bg-muted border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                              onClick={() => purchase.receiptId && handleViewReceipt(purchase.receiptId)}
                            >
                              <img 
                                src={purchase.imageUrl} 
                                alt="Receipt" 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="shrink-0 w-16 h-20 sm:w-20 sm:h-24 rounded-md bg-muted border flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                          )}

                          {/* Purchase Details */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium truncate">{purchase.merchant || 'Unknown Merchant'}</span>
                              {index === 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  Latest
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                {purchase.date ? format(new Date(purchase.date), 'MMM dd, yyyy') : 'Date unknown'}
                              </div>
                              {purchase.quantity && (
                                <div className="flex items-center gap-1.5">
                                  <ShoppingCart className="h-3.5 w-3.5" />
                                  Qty: {purchase.quantity}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <div className="font-semibold text-lg">
                                {analysis.summary.currency} {parseFloat(purchase.price).toFixed(2)}
                              </div>

                              {purchase.receiptId && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewReceipt(purchase.receiptId)}
                                  disabled={isLoadingReceipt}
                                  className="gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  {isLoadingReceipt ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      Loading...
                                    </>
                                  ) : (
                                    <>
                                      View Receipt
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleRefresh} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Refresh
              </Button>
            </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Receipt Detail Modal */}
    <ReceiptDetailModal
      receipt={selectedReceipt}
      open={isReceiptModalOpen}
      onOpenChange={(open) => {
        setIsReceiptModalOpen(open);
        if (!open) {
          setSelectedReceipt(null);
        }
      }}
    />
  </>
  );
}
