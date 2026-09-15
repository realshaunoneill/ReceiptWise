'use client';

import { Calendar, MapPin, Clock, CreditCard, Users, ChevronRight, Receipt as ReceiptIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { categoryBadgeClasses, categoryTextClasses, getCategory } from '@/lib/utils/categories';
import { format, parseISO, isToday, isYesterday, isThisWeek, isThisMonth, startOfDay } from 'date-fns';
import type { ReceiptWithItems } from '@/lib/types/api-responses';
import { useCurrency } from '@/lib/hooks/use-currency';
import { cn } from '@/lib/utils';

interface ReceiptTimelineProps {
  receipts: ReceiptWithItems[];
  onReceiptClick: (receipt: ReceiptWithItems) => void;
}

function getDateLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date)) return format(date, 'EEEE'); // Monday, Tuesday, etc.
  if (isThisMonth(date)) return format(date, 'MMMM d'); // January 15
  return format(date, 'MMMM d, yyyy'); // January 15, 2025
}

function getDateSubtitle(date: Date): string {
  if (isToday(date) || isYesterday(date)) {
    return format(date, 'EEEE, MMMM d');
  }
  if (isThisWeek(date)) {
    return format(date, 'MMMM d');
  }
  return format(date, 'EEEE');
}

interface GroupedReceipts {
  label: string;
  subtitle: string;
  date: Date;
  receipts: ReceiptWithItems[];
  totalSpent: number;
  currency: string;
}

function groupReceiptsByDate(receipts: ReceiptWithItems[]): GroupedReceipts[] {
  const groups: Record<string, { receipts: ReceiptWithItems[]; date: Date; totalSpent: number; currency: string }> = {};

  receipts.forEach(receipt => {
    let dateStr: string | undefined;

    if (receipt.transactionDate) {
      dateStr = receipt.transactionDate;
    } else if (receipt.createdAt) {
      dateStr = typeof receipt.createdAt === 'string'
        ? receipt.createdAt
        : receipt.createdAt.toISOString();
    }

    if (!dateStr) return;

    const date = parseISO(dateStr);
    const dayKey = startOfDay(date).toISOString();

    if (!groups[dayKey]) {
      groups[dayKey] = { receipts: [], date, totalSpent: 0, currency: receipt.currency || 'EUR' };
    }
    groups[dayKey].receipts.push(receipt);
    groups[dayKey].totalSpent += parseFloat(receipt.totalAmount || '0');
  });

  return Object.entries(groups)
    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
    .map(([_, group]) => ({
      label: getDateLabel(group.date),
      subtitle: getDateSubtitle(group.date),
      date: group.date,
      receipts: group.receipts,
      totalSpent: group.totalSpent,
      currency: group.currency,
    }));
}

export function ReceiptTimeline({ receipts, onReceiptClick }: ReceiptTimelineProps) {
  const { format: formatCurrency } = useCurrency();
  const groupedReceipts = groupReceiptsByDate(receipts);

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

  return (
    <div className="space-y-6">
      {groupedReceipts.map((group) => (
        <div key={group.date.toISOString()} className="relative">
          {/* Date header. The day total was previously flagged with a
              TrendingUp arrow, which reads as "spending is up" — it is just a
              count, and one day's total trends nowhere. */}
          <div className="sticky top-0 z-10 -mx-4 mb-4 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex items-baseline gap-3">
                <Calendar className="h-4 w-4 shrink-0 translate-y-0.5 text-muted-foreground" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-semibold text-foreground">{group.label}</h3>
                  <p className="text-xs text-muted-foreground">{group.subtitle}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="amount text-base font-semibold text-foreground">
                  {formatCurrency(group.totalSpent)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {group.receipts.length} receipt{group.receipts.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Receipt cards for this date */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.receipts.map((receipt) => {
              const category = getCategory(receipt.category);
              const CategoryIcon = category.icon;

              const isProcessing = receipt.processingStatus === 'pending' || receipt.processingStatus === 'processing';
              const isFailed = receipt.processingStatus === 'failed';

              return (
                <Card
                  key={receipt.id}
                  onClick={() => onReceiptClick(receipt)}
                  className={cn(
                    // The 1px lift on hover made whole grids of cards jump as the
                    // pointer crossed them. Border and shadow are enough feedback.
                    'group cursor-pointer overflow-hidden transition-colors hover:border-primary/40',
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
                              {receipt.merchantName || 'Unknown Merchant'}
                            </h4>
                            {receipt.location && (
                              <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {receipt.location}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        {/*
                          Amount. This read `{receipt.currency || '€'}{amount}`,
                          which printed the ISO *code* jammed against the figure —
                          "EUR12.50" — and fell back to a euro sign regardless of
                          the user's chosen currency. The day total directly above
                          it was already going through the formatter, so a single
                          card could show "EUR12.50" under a "€45.00" heading.
                        */}
                        <p className="amount mt-2 text-xl font-semibold">
                          {formatCurrency(parseFloat(receipt.totalAmount || '0'))}
                        </p>
                      </div>
                    </div>

                    {/* Bottom section with badges */}
                    <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5">
                      {/* Status badges */}
                      {isProcessing && (
                        <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          Processing
                        </Badge>
                      )}
                      {isFailed && (
                        <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                          Failed
                        </Badge>
                      )}

                      {/* Category badge */}
                      {receipt.category && !isProcessing && !isFailed && (
                        <Badge variant="outline" className={categoryBadgeClasses(receipt.category)}>
                          <CategoryIcon className="h-3 w-3" aria-hidden="true" />
                          {category.label}
                        </Badge>
                      )}

                      {/* Time badge */}
                      {receipt.transactionDate && (
                        <Badge variant="outline" className="bg-muted/50 text-muted-foreground">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {format(parseISO(receipt.transactionDate), 'h:mm a')}
                        </Badge>
                      )}

                      {/* Payment method */}
                      {receipt.paymentMethod && (
                        <Badge variant="outline" className="bg-muted/50 capitalize text-muted-foreground">
                          <CreditCard className="h-3 w-3" aria-hidden="true" />
                          {receipt.paymentMethod.replace(/_/g, ' ')}
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
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
