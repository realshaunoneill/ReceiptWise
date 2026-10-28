'use client';

import { Calendar, MapPin, Clock, CreditCard, Users, ChevronRight, Receipt as ReceiptIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { categoryBadgeClasses, categoryTextClasses, getCategory } from '@/lib/utils/categories';
import type { ReceiptWithItems, OCRData } from '@/lib/types/api-responses';
import { useCurrency } from '@/lib/hooks/use-currency';
import { formatCurrency } from '@/lib/utils/currency';
import { formatTotals, totalsByCurrency } from '@/lib/utils/currency-totals';
import { localToday } from '@/lib/dates/local-date';
import { isStuckProcessing } from '@/lib/utils/receipt-status';
import { dayHeading, formatDisplayDate, formatPaymentMethod, receiptDay } from '@/components/receipts/format';
import { cn } from '@/lib/utils';

interface ReceiptTimelineProps {
  receipts: ReceiptWithItems[];
  onReceiptClick: (receipt: ReceiptWithItems) => void;
  /** The list's sort. Only a date sort is grouped by day; any other order is shown as it came. */
  sortBy?: string;
}

interface GroupedReceipts {
  day: string;
  label: string;
  receipts: ReceiptWithItems[];
}

/*
 * Groups in the order the receipts arrive. They were re-sorted newest-first here, which undid an
 * "oldest first" sort from the server; and sorting by amount or merchant still came out as date
 * groups, so changing the sort did nothing visible.
 */
function groupReceiptsByDate(receipts: ReceiptWithItems[]): GroupedReceipts[] {
  const groups = new Map<string, ReceiptWithItems[]>();

  receipts.forEach(receipt => {
    const day = receiptDay(receipt);
    if (!day) return;
    const group = groups.get(day) ?? [];
    group.push(receipt);
    groups.set(day, group);
  });

  // "Today", "Yesterday", "Wed 7 Jan": one line, as in the app (it was "7 January 2026" over a weekday).
  const today = localToday();
  return Array.from(groups, ([day, dayReceipts]) => ({
    day,
    label: dayHeading(day, today),
    receipts: dayReceipts,
  }));
}

export function ReceiptTimeline({ receipts, onReceiptClick, sortBy = 'date' }: ReceiptTimelineProps) {
  const { currency: userCurrency } = useCurrency();
  const groupedReceipts = sortBy === 'date' ? groupReceiptsByDate(receipts) : [];

  if (receipts.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <ReceiptIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No receipts found</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Upload your first receipt to start building your spending timeline
          </p>
        </CardContent>
      </Card>
    );
  }

  const renderCard = (receipt: ReceiptWithItems, showDate: boolean) => {
    const category = getCategory(receipt.category);
    const CategoryIcon = category.icon;

    const isStuck = isStuckProcessing(receipt);
    const isProcessing = !isStuck && (receipt.processingStatus === 'pending' || receipt.processingStatus === 'processing');
    const isFailed = receipt.processingStatus === 'failed' || isStuck;
    const timeOfDay = (receipt.ocrData as OCRData | null)?.timeOfDay;
    const day = showDate ? receiptDay(receipt) : null;

    return (
      /* A div with only onClick before, so the cards could not be reached or
         opened from the keyboard. */
      <Card
        key={receipt.id}
        role="button"
        tabIndex={0}
        onClick={() => onReceiptClick(receipt)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onReceiptClick(receipt);
          }
        }}
        className={cn(
          // The 1px lift on hover made whole grids of cards jump as the
          // pointer crossed them. Border and shadow are enough feedback.
          'group cursor-pointer overflow-hidden transition-colors outline-none hover:border-primary/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          isFailed && 'border-destructive/40 bg-destructive/5',
          isProcessing && 'border-warning/40 bg-warning/5',
        )}
      >
        <CardContent className="p-0">
          {/* Top section with thumbnail and main info */}
          <div className="flex gap-3 p-4">
            {/* Receipt thumbnail */}
            <div className="shrink-0">
              <div className="h-16 w-16 overflow-hidden rounded-lg border bg-muted">
                {receipt.imageUrl ? (
                  <img
                    src={receipt.imageUrl}
                    alt={`Receipt from ${receipt.merchantName || 'merchant'}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  /* Was an emoji per category (🛒 🍽️ ⛽ ...). Emoji
                     render differently on every platform, cannot be
                     recoloured, and undercut a financial record. */
                  <div className="flex h-full w-full items-center justify-center">
                    <CategoryIcon
                      className={cn('h-6 w-6', categoryTextClasses(receipt.category))}
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-semibold truncate group-hover:text-primary transition-colors">
                    {receipt.merchantName || 'Unknown merchant'}
                  </h4>
                  {receipt.location && (
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                      {receipt.location}
                    </p>
                  )}
                  {day && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
                      {formatDisplayDate(day)}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" aria-hidden="true" />
              </div>

              {/*
                Amount. This read `{receipt.currency || '€'}{amount}`,
                which printed the ISO *code* jammed against the figure —
                "EUR12.50" — and fell back to a euro sign regardless of
                the user's chosen currency. It is now formatted in the
                receipt's own currency, the user's when it has none.
              */}
              <p className="amount mt-2 text-xl font-semibold">
                {formatCurrency(parseFloat(receipt.totalAmount || '0'), receipt.currency || userCurrency)}
              </p>
            </div>
          </div>

          {/* Bottom section with badges */}
          <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5">
            {/* Status badges */}
            {isProcessing && (
              <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                <Clock className="h-3 w-3" aria-hidden="true" />
                Reading…
              </Badge>
            )}
            {isFailed && (
              <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                {isStuck ? 'Didn’t finish · open it to try again' : 'Couldn’t read'}
              </Badge>
            )}

            {/* Category badge */}
            {receipt.category && !isProcessing && !isFailed && (
              <Badge variant="outline" className={categoryBadgeClasses(receipt.category)}>
                <CategoryIcon className="h-3 w-3" aria-hidden="true" />
                {category.label}
              </Badge>
            )}

            {/* Time badge. transactionDate is a date with no time, so formatting it
                as a time printed "12:00 AM" on every card; the time read off the
                receipt, when there is one, lives in the OCR data. */}
            {typeof timeOfDay === 'string' && timeOfDay && (
              <Badge variant="outline" className="bg-muted/50 text-muted-foreground">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {timeOfDay}
              </Badge>
            )}

            {/* Payment method */}
            {receipt.paymentMethod && (
              <Badge variant="outline" className="bg-muted/50 text-muted-foreground">
                <CreditCard className="h-3 w-3" aria-hidden="true" />
                {formatPaymentMethod(receipt.paymentMethod)}
              </Badge>
            )}

            {/* Household indicator */}
            {receipt.householdId && (
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                <Users className="h-3 w-3" aria-hidden="true" />
                Shared
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Sorted by amount or merchant: one list in that order, each card carrying its own date.
  if (sortBy !== 'date') {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {receipts.map((receipt) => renderCard(receipt, true))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedReceipts.map((group) => (
        <div key={group.day} className="relative">
          {/* Date header. The day total was previously flagged with a
              TrendingUp arrow, which reads as "spending is up" — it is just a
              count, and one day's total trends nowhere. A day with one receipt shows
              no total or count: they only repeated the card below. */}
          <div className="sticky top-0 z-10 -mx-4 mb-4 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex items-baseline gap-3">
                <Calendar className="h-4 w-4 shrink-0 translate-y-0.5 text-muted-foreground" aria-hidden="true" />
                <h3 className="text-base font-semibold text-foreground">{group.label}</h3>
              </div>
              {group.receipts.length > 1 && (
                <div className="text-right">
                  {/* Per currency: a day with a euro and a sterling receipt was summed as one figure. */}
                  <p className="amount text-base font-semibold text-foreground">
                    {formatTotals(
                      totalsByCurrency(
                        group.receipts.map((r) => ({ amount: r.totalAmount || '0', currency: r.currency })),
                        userCurrency,
                      ),
                      userCurrency,
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{group.receipts.length} receipts</p>
                </div>
              )}
            </div>
          </div>

          {/* Receipt cards for this date */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.receipts.map((receipt) => renderCard(receipt, false))}
          </div>
        </div>
      ))}
    </div>
  );
}
