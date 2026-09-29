'use client';

import { useState } from 'react';
import { ReceiptIcon, Calendar, Store, Users, RefreshCw, Briefcase, AlertTriangle, ImageOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReceiptDetailModal } from '@/components/receipts/receipt-detail-modal';
import { categoryBadgeClasses, getCategory } from '@/lib/utils/categories';
import { ReceiptStatusBadge } from '@/components/receipts/receipt-status-badge';
import { useCurrency } from '@/lib/hooks/use-currency';
import { cn } from '@/lib/utils';
import type { ReceiptWithItems } from '@/lib/types/api-responses';
import { useUser } from '@/lib/hooks/use-user';
import { canRetryReceipt, isStuckProcessing } from '@/lib/utils/receipt-status';
import { toast } from 'sonner';

interface ReceiptListProps {
  receipts: ReceiptWithItems[];
  onReceiptClick?: (receipt: ReceiptWithItems) => void;
  onRetry?: () => void;
}

export function ReceiptList({ receipts, onReceiptClick, onRetry }: ReceiptListProps) {
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptWithItems | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const { format: formatCurrency } = useCurrency();
  // Retry is owner-only on the server; a household member's receipt would just 403.
  const { user: currentUser } = useUser();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleRetry = async (receiptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRetryingId(receiptId);

    try {
      const response = await fetch(`/api/receipts/${receiptId}/retry`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to retry processing');
      }

      toast.success('Receipt processed');

      // Call the onRetry callback to refresh the list
      if (onRetry) {
        onRetry();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to retry processing');
    } finally {
      setRetryingId(null);
    }
  };


  const handleReceiptClick = (receipt: ReceiptWithItems) => {
    if (onReceiptClick) {
      onReceiptClick(receipt);
    } else {
      setSelectedReceipt(receipt);
      setModalOpen(true);
    }
  };

  return (
    <>
      <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ReceiptIcon className="h-5 w-5" />
          Recent Receipts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ReceiptIcon className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm font-medium text-muted-foreground">No receipts yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Upload your first receipt to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {receipts.map((receipt) => {
              // Check if this is not actually a receipt
              const isNotReceipt = receipt.isReceipt === false;

              return (
              <div
                key={receipt.id}
                onClick={() => handleReceiptClick(receipt)}
                className={cn(
                  'flex cursor-pointer flex-col gap-3 rounded-lg border p-3 transition-colors sm:flex-row sm:items-center sm:gap-4 sm:p-4',
                  isNotReceipt
                    ? 'border-warning/40 bg-warning/8 hover:bg-warning/12'
                    : 'bg-card hover:bg-muted/50',
                )}
              >
                {/* Receipt Image Thumbnail */}
                <div className="shrink-0">
                  <div className="h-16 w-16 overflow-hidden rounded-md border bg-muted relative">
                    {receipt.imageUrl ? (
                      <>
                        <img
                          src={receipt.imageUrl || '/placeholder.svg'}
                          alt={`Receipt from ${receipt.merchantName || 'merchant'}`}
                          className="h-full w-full object-cover"
                        />
                        {isNotReceipt && (
                          <div className="absolute inset-0 flex items-center justify-center bg-warning/25">
                            <AlertTriangle className="h-6 w-6 text-warning" aria-hidden="true" />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ReceiptIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Receipt Details */}
                <div className="flex-1 space-y-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-foreground">
                        {receipt.merchantName || 'Unknown Merchant'}
                      </span>
                    </div>
                    {/* Was `{receipt.currency || '$'} {receipt.totalAmount}` —
                        the ISO code in place of a symbol, and a dollar fallback
                        in a product that defaults to euro. */}
                    <span className="amount text-lg font-semibold text-foreground sm:whitespace-nowrap">
                      {formatCurrency(parseFloat(receipt.totalAmount || '0'))}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:gap-3">
                    {isNotReceipt && (
                      <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                        <ImageOff className="h-3 w-3" aria-hidden="true" />
                        Not a receipt
                      </Badge>
                    )}
                    {receipt.transactionDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span className="hidden sm:inline">{receipt.transactionDate}</span>
                        <span className="sm:hidden">{formatDate(receipt.transactionDate)}</span>
                      </div>
                    )}
                    {receipt.processingStatus && <ReceiptStatusBadge status={receipt.processingStatus} />}
                    {receipt.category && (
                      /* Looked up with the raw string before, so a capitalised
                         category from the scanner silently fell through to the
                         grey "other" style here while the timeline coloured it
                         correctly. `getCategory` normalises the key. */
                      <Badge variant="outline" className={categoryBadgeClasses(receipt.category)}>
                        {getCategory(receipt.category).label}
                      </Badge>
                    )}
                    {receipt.paymentMethod && (
                      <span className="capitalize">{receipt.paymentMethod.replace(/_/g, ' ')}</span>
                    )}
                    {receipt.items && receipt.items.length > 0 && (
                      <span>
                        {receipt.items.length} item{receipt.items.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {receipt.householdId && (
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                        <Users className="h-3 w-3" aria-hidden="true" />
                        Shared
                      </Badge>
                    )}
                    {receipt.isBusinessExpense && (
                      <Badge variant="outline" className="border-info/30 bg-info/10 text-info">
                        <Briefcase className="h-3 w-3" aria-hidden="true" />
                        Business
                      </Badge>
                    )}
                    {receipt.submittedBy && receipt.householdId && (
                      <span className="text-xs">
                        by {receipt.submittedBy.split('@')[0]}
                      </span>
                    )}
                  </div>

                  {/* Retry for failed receipts, and for ones whose processing never finished */}
                  {canRetryReceipt(receipt) && currentUser?.id === receipt.userId && (
                    <div className="mt-2 space-y-1.5">
                      {receipt.processingStatus === 'failed' && receipt.processingError && (
                        <p className="text-xs text-destructive">{receipt.processingError}</p>
                      )}
                      {isStuckProcessing(receipt) && (
                        <p className="text-xs text-muted-foreground">
                          This one hasn&apos;t finished reading.
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleRetry(receipt.id, e)}
                          disabled={retryingId === receipt.id}
                        >
                          {retryingId === receipt.id ? (
                            <>
                              <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
                              Retrying
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-3 w-3" aria-hidden="true" />
                              Try again
                            </>
                          )}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Still failing? Email support and we&apos;ll look at it.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        )}
      </CardContent>
    </Card>

      {!onReceiptClick && (
        <ReceiptDetailModal
          receipt={selectedReceipt}
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open);
            if (!open) {
              setSelectedReceipt(null);
            }
          }}
        />
      )}
    </>
  );
}
