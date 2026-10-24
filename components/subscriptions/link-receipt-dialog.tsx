'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Link as LinkIcon, Search, Receipt as ReceiptIcon, Calendar, Unlink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useUpdatePayment, useUnlinkPayment } from '@/hooks/use-subscriptions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { type Subscription, type SubscriptionPayment } from '@/lib/db/schema';
import { addDays, formatLocalDate, fromUtcDate, isLocalDate } from '@/lib/dates/local-date';
import { formatCurrency } from '@/lib/utils/currency';
import { fromCents } from '@/lib/money';
import { paymentStatusLabel } from './labels';
import { type ReceiptMismatch, receiptMismatches } from './receipt-match';

/** Receipts this many days either side of the selected payment are offered. */
const MATCH_WINDOW_DAYS = 10;
const RECEIPTS_SHOWN = 50;
const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

function paymentDay(payment: SubscriptionPayment): string {
  return payment.dueDate ?? fromUtcDate(new Date(payment.expectedDate));
}

type LinkReceiptDialogProps = {
  subscription: Subscription;
  payments: SubscriptionPayment[];
  /** The trigger. Leave it out and pass open/onOpenChange to open the dialog from elsewhere. */
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type Receipt = {
  id: string;
  merchantName: string | null;
  totalAmount: string | null;
  currency: string | null;
  transactionDate: string | null;
  category: string | null;
  imageUrl: string;
  createdAt: Date;
};

function mismatchText(problem: ReceiptMismatch, name: string, currency: string): string {
  switch (problem.kind) {
    case 'currency':
      return `It's in ${problem.receiptCurrency}, not ${problem.expectedCurrency}.`;
    case 'amount':
      return `It's for ${formatCurrency(Number(fromCents(problem.receiptCents)), currency)}, not the ${formatCurrency(Number(fromCents(problem.expectedCents)), currency)} expected.`;
    case 'merchant':
      return `It's from ${problem.merchant}, which doesn't look like ${name}.`;
  }
}

export function LinkReceiptDialog({ subscription, payments, children, open: controlledOpen, onOpenChange }: LinkReceiptDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const { mutate: linkReceipt, isPending } = useUpdatePayment(subscription.id);
  const { mutate: unlinkReceipt, isPending: isUnlinking } = useUnlinkPayment(subscription.id);

  // Debounce the search so typing doesn't send a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectedPayment = payments.find((payment) => payment.id === selectedPaymentId);
  const around = selectedPayment ? paymentDay(selectedPayment) : null;

  // Receipts near the selected payment's date (or the most recent, before one is picked), searched
  // on the server. It used to fetch page 1 of /api/receipts, the 10 most recent, and filter
  // those in the browser, so anything older could never be linked.
  const { data: receipts, isLoading: loadingReceipts } = useQuery<Receipt[]>({
    queryKey: ['receipts', 'link-candidates', around, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(RECEIPTS_SHOWN) });
      if (around && !debouncedSearch) {
        params.set('startDate', addDays(around, -MATCH_WINDOW_DAYS));
        params.set('endDate', addDays(around, MATCH_WINDOW_DAYS));
      }
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`/api/receipts?${params}`);
      if (!res.ok) throw new Error('Failed to fetch receipts');
      const data = await res.json();
      return data.receipts || [];
    },
    enabled: open,
  });

  const selectedReceipt = receipts?.find((receipt) => receipt.id === selectedReceiptId);
  const expectedCurrency = selectedPayment?.currency ?? subscription.currency;
  // Linking marks the payment paid at the receipt's amount (AVOCA €30.05 once marked Netflix
  // paid at €30.05 without a word), so say when the receipt clearly isn't for this payment.
  const mismatches = selectedPayment && selectedReceipt
    ? receiptMismatches(selectedReceipt, {
      name: subscription.name,
      providerKey: subscription.providerKey,
      amount: selectedPayment.expectedAmount,
      currency: expectedCurrency,
    })
    : [];

  const handleLink = () => {
    if (!selectedPaymentId || !selectedReceiptId) {
      toast.error('Please select both a payment and a receipt to link');
      return;
    }

    linkReceipt(
      {
        paymentId: selectedPaymentId,
        data: { receiptId: selectedReceiptId },
      },
      {
        onSuccess: () => {
          toast.success('Receipt linked successfully');
          setOpen(false);
          setSelectedPaymentId(null);
          setSelectedReceiptId(null);
          setSearchQuery('');
        },
        onError: (error) => {
          toast.error('Failed to link receipt', { description: error.message });
        },
      },
    );
  };

  const handleUnlink = (paymentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    unlinkReceipt(paymentId, {
      onSuccess: () => {
        toast.success('Receipt unlinked');
      },
      onError: (error) => {
        toast.error('Failed to unlink receipt', { description: error.message });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {(children || controlledOpen === undefined) && (
        <DialogTrigger asChild>
          {children || (
            <Button variant="outline" size="sm">
              <LinkIcon className="w-4 h-4 mr-2" />
              Link receipt
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Link a receipt to {subscription.name}</DialogTitle>
          <DialogDescription>
            Pick the payment, then the receipt that paid it. The payment is marked paid at the receipt&apos;s amount.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 md:grid-cols-2">
          {/* Payments Column */}
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold mb-2">Payments</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Select a payment to link a receipt to
              </p>
            </div>

            <ScrollArea className="h-56 pr-4 md:h-[400px]">
              {payments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No payments found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payments.map((payment) => {
                    const isLinked = !!(payment.receiptId && payment.status === 'paid');
                    return (
                      <div
                        key={payment.id}
                        className={`w-full p-3 rounded-lg border transition-colors ${
                          selectedPaymentId === payment.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border'
                        } ${
                          isLinked ? 'opacity-75' : ''
                        }`}
                      >
                        <button
                          onClick={() => !isLinked && setSelectedPaymentId(payment.id)}
                          className="w-full text-left"
                          disabled={isLinked}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">
                                {formatLocalDate(paymentDay(payment), DATE_FORMAT, 'en-IE')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  payment.status === 'paid'
                                    ? 'default'
                                    : payment.status === 'missed'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                              >
                                {paymentStatusLabel(payment.status)}
                              </Badge>
                              {isLinked && (
                                <Badge variant="outline">
                                  <LinkIcon className="w-3 h-3 mr-1" />
                                  Linked
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="amount text-sm text-muted-foreground">
                            Expected: {formatCurrency(parseFloat(payment.expectedAmount || '0'), payment.currency ?? subscription.currency)}
                          </div>
                        </button>
                        {isLinked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 w-full"
                            onClick={(e) => handleUnlink(payment.id, e)}
                            disabled={isUnlinking}
                          >
                            <Unlink className="w-4 h-4 mr-2" />
                            {isUnlinking ? 'Unlinking…' : 'Unlink receipt'}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Receipts Column */}
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold mb-2">Your receipts</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {around && !debouncedSearch
                  ? `Within ${MATCH_WINDOW_DAYS} days of ${formatLocalDate(around, DATE_FORMAT, 'en-IE')}`
                  : debouncedSearch ? 'Matching your search' : 'Most recent'}
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search receipts…"
                  aria-label="Search receipts"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <ScrollArea className="h-56 pr-4 md:h-[400px]">
              {loadingReceipts ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading receipts...
                </div>
              ) : receipts && receipts.length > 0 ? (
                <div className="space-y-2">
                  {receipts.map((receipt) => (
                    <button
                      key={receipt.id}
                      onClick={() => setSelectedReceiptId(receipt.id)}
                      className={`w-full p-3 rounded-lg border text-left transition-colors ${
                        selectedReceiptId === receipt.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={receipt.imageUrl}
                          alt={receipt.merchantName || 'Receipt'}
                          className="w-12 h-12 object-cover rounded border"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {receipt.merchantName || 'Unknown merchant'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {receipt.transactionDate && isLocalDate(receipt.transactionDate)
                              ? formatLocalDate(receipt.transactionDate, DATE_FORMAT, 'en-IE')
                              : formatLocalDate(fromUtcDate(new Date(receipt.createdAt)), DATE_FORMAT, 'en-IE')}
                          </div>
                          <div className="amount text-sm font-medium mt-1">
                            {formatCurrency(parseFloat(receipt.totalAmount || '0'), receipt.currency ?? subscription.currency)}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ReceiptIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No receipts found</p>
                  {searchQuery && (
                    <p className="text-sm mt-1">Try a different search term</p>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {mismatches.length > 0 && (
          <div role="alert" className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium">This receipt may not be for {subscription.name}</p>
              {mismatches.map((problem) => <p key={problem.kind} className="text-muted-foreground">{mismatchText(problem, subscription.name, expectedCurrency)}</p>)}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending || isUnlinking}>
            Cancel
          </Button>
          <Button
            onClick={handleLink}
            disabled={!selectedPaymentId || !selectedReceiptId || isPending || isUnlinking}
          >
            {isPending ? 'Linking…' : mismatches.length > 0 ? 'Link anyway' : 'Link receipt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
