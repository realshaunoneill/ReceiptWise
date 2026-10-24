'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Check,
  ExternalLink,
  FileText,
  MoreVertical,
  Trash2,
  Edit,
  Pause,
  Play,
  X,
  Receipt as ReceiptIcon,
  Link as LinkIcon,
  Unlink,
  Eye,
  SkipForward,
  Undo2,
} from 'lucide-react';
import {
  useSubscription,
  useDeleteSubscription,
  useUpdateSubscription,
  useUnlinkPayment,
  useUpdatePayment,
  type UpdatePaymentData,
} from '@/hooks/use-subscriptions';
import { type SubscriptionPayment } from '@/lib/db/schema';
import { formatLocalDate, fromUtcDate, localToday } from '@/lib/dates/local-date';
import { useHouseholds } from '@/lib/hooks/use-households';
import { useAccounts } from '@/lib/hooks/use-plan';
import { useFeature } from '@/lib/hooks/use-user';
import { frequencyLabel } from '@/lib/schedule/billing-schedule';
import type { HouseholdWithMembers } from '@/lib/types/api-responses';
import { formatCurrency } from '@/lib/utils/currency';
import { frequencyName, itemNoun, paymentMethodLabel, paymentStatusLabel, statusLabel } from './labels';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { LinkReceiptDialog } from './link-receipt-dialog';
import { EditSubscriptionDialog } from './edit-subscription-dialog';

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** A midnight-UTC timestamp column as its calendar day, formatted without shifting it a day west of UTC. */
function formatDay(value: Date | string): string {
  return formatLocalDate(fromUtcDate(new Date(value)), DATE_FORMAT, 'en-IE');
}

/** "12 Aug – 11 Oct", the period a bill covers. */
function formatPeriod(start: string, end: string): string {
  const short: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${formatLocalDate(start, short, 'en-IE')} – ${formatLocalDate(end, short, 'en-IE')}`;
}

/** The account's name. Its own component so accounts (a bills-only API) are only fetched with bills on. */
function AccountName({ accountId }: { accountId: string | null }) {
  const { data: accounts } = useAccounts();
  if (!accountId) return <>Main account</>;
  return <>{accounts?.find((account) => account.id === accountId)?.name ?? 'Another account'}</>;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right font-medium">{children}</div>
    </div>
  );
}

const PAID_VIA_LABEL: Record<string, string> = {
  assumed: 'Assumed paid',
  manual: 'Marked paid',
};

type SubscriptionDetailModalProps = {
  subscriptionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SubscriptionDetailModal({
  subscriptionId,
  open,
  onOpenChange,
}: SubscriptionDetailModalProps) {
  const router = useRouter();
  const { data: subscription, isLoading } = useSubscription(subscriptionId || '');
  const { mutate: deleteSubscription } = useDeleteSubscription();
  const { mutate: updateSubscription } = useUpdateSubscription(subscriptionId || '');
  const { mutate: unlinkPayment } = useUnlinkPayment(subscriptionId || '');
  const { mutate: updatePayment, isPending: isUpdatingPayment } = useUpdatePayment(subscriptionId || '');
  const billsEnabled = useFeature('bills');
  const { data: households } = useHouseholds();
  // Cancelling and deleting both ask first, inside the dialog. Cancel used to act straight from the menu.
  const [confirming, setConfirming] = useState<'delete' | 'cancel' | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const noun = itemNoun(subscription?.kind, billsEnabled);

  const handleDelete = () => {
    if (!subscriptionId) return;

    deleteSubscription(subscriptionId, {
      onSuccess: () => {
        toast.success(`Deleted ${subscription?.name ?? `the ${noun}`}`);
        onOpenChange(false);
        setConfirming(null);
      },
      onError: (error) => {
        toast.error('Failed to delete', { description: error.message });
      },
    });
  };

  const handleToggleStatus = () => {
    if (!subscription) return;

    const newStatus = subscription.status === 'active' ? 'paused' : 'active';

    updateSubscription(
      { status: newStatus },
      {
        onSuccess: () => {
          toast.success(`${subscription.name} is now ${statusLabel(newStatus).toLowerCase()}`);
        },
        onError: (error) => {
          toast.error('Failed to update status', { description: error.message });
        },
      },
    );
  };

  const handleCancel = () => {
    if (!subscription) return;

    // The server ends it today when no end date is given.
    updateSubscription(
      { status: 'cancelled' },
      {
        onSuccess: () => {
          toast.success(`${subscription.name} has been cancelled`);
          setConfirming(null);
        },
        onError: (error) => {
          toast.error('Failed to cancel', { description: error.message });
        },
      },
    );
  };

  const handleUnlinkReceipt = (paymentId: string) => {
    unlinkPayment(paymentId, {
      onSuccess: () => {
        toast.success('Receipt unlinked');
      },
      onError: () => {
        toast.error('Failed to unlink. Please try again.');
      },
    });
  };

  const handlePaymentChange = (payment: SubscriptionPayment, data: UpdatePaymentData, message: string) => {
    updatePayment(
      { paymentId: payment.id, data },
      {
        onSuccess: () => toast.success(message),
        onError: (error) => toast.error('Failed to update payment', { description: error.message }),
      },
    );
  };

  const handleViewReceipt = (receiptId: string) => {
    router.push(`/receipts?selected=${receiptId}`);
    onOpenChange(false);
  };

  if (confirming) {
    const deleting = confirming === 'delete';
    return (
      <Dialog open={open} onOpenChange={(next) => { if (!next) setConfirming(null); onOpenChange(next); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleting ? `Delete ${subscription?.name ?? `this ${noun}`}?` : `Cancel ${subscription?.name ?? `this ${noun}`}?`}</DialogTitle>
            <DialogDescription>
              {deleting
                ? 'This removes it and all its payment records, and cannot be undone.'
                : 'It ends today, so nothing more is expected after this. Its payment history is kept, and you can resume it from the Cancelled tab.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirming(null)}>
              {deleting ? 'Keep it' : 'Don’t cancel'}
            </Button>
            <Button variant="destructive" onClick={deleting ? handleDelete : handleCancel}>
              {deleting ? 'Delete' : `Cancel ${noun}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const household = subscription?.householdId
    ? (households as HouseholdWithMembers[] | undefined)?.find((h) => h.id === subscription.householdId)
    : null;
  const bills = subscription?.bills ?? [];
  const billForPayment = (paymentId: string) => bills.find((bill) => bill.paymentId === paymentId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : subscription ? (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <DialogTitle className="flex items-center gap-2 text-2xl">
                    {subscription.name}
                    {subscription.isBusinessExpense && (
                      <Badge variant="secondary">Business</Badge>
                    )}
                  </DialogTitle>
                  {subscription.description && (
                    <DialogDescription className="mt-2">
                      {subscription.description}
                    </DialogDescription>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={subscription.status === 'active' ? 'default' : 'secondary'}
                  >
                    {statusLabel(subscription.status)}
                  </Badge>
                  {subscription.canEdit !== false && <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions for ${subscription.name}`}>
                        <MoreVertical className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit details
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleToggleStatus}>
                        {subscription.status === 'active' ? (
                          <>
                            <Pause className="w-4 h-4 mr-2" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Resume
                          </>
                        )}
                      </DropdownMenuItem>
                      {subscription.status !== 'cancelled' && (
                        <DropdownMenuItem onClick={() => setConfirming('cancel')}>
                          <X className="w-4 h-4 mr-2" />
                          Cancel {noun}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setConfirming('delete')}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>}
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-6 mt-6">
              {/* Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <DetailRow label={subscription.amountType === 'variable' ? 'Usual amount' : 'Amount'}>
                    <span className="amount text-2xl font-bold">
                      {subscription.amountType === 'variable' ? '~' : ''}
                      {formatCurrency(parseFloat(subscription.amount), subscription.currency)}
                    </span>
                    {' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      {frequencyLabel(subscription.billingFrequency, subscription.customFrequencyDays)}
                    </span>
                  </DetailRow>
                  {billsEnabled && (
                    <DetailRow label="Type">
                      {subscription.kind === 'bill' ? 'Bill' : 'Subscription'}
                      {' · '}
                      {subscription.amountType === 'variable' ? 'amount changes' : 'fixed amount'}
                    </DetailRow>
                  )}
                  <DetailRow label="How often">{frequencyName(subscription.billingFrequency, subscription.customFrequencyDays)}</DetailRow>
                  {subscription.billingFrequency !== 'custom' && subscription.billingFrequency !== 'once' && (
                    <DetailRow label="Day of the month">{subscription.billingDay}</DetailRow>
                  )}
                  {billsEnabled && (
                    <>
                      <DetailRow label="How it's paid">{paymentMethodLabel(subscription.paymentMethod)}</DetailRow>
                      <DetailRow label="Paid from"><AccountName accountId={subscription.paidFromAccountId} /></DetailRow>
                    </>
                  )}
                  <DetailRow label="Shared with">
                    {subscription.householdId ? household?.name ?? 'A household' : 'Just you'}
                  </DetailRow>
                  {subscription.category && (
                    <DetailRow label="Category">
                      <Badge variant="outline">{subscription.category}</Badge>
                    </DetailRow>
                  )}
                </CardContent>
              </Card>

              {/* Dates */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Dates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Started</span>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {formatDay(subscription.startDate)}
                    </div>
                  </div>
                  {subscription.nextBillingDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Next due</span>
                      <div className="flex items-center gap-2 font-medium">
                        <Calendar className="w-4 h-4" />
                        {formatDay(subscription.nextBillingDate)}
                      </div>
                    </div>
                  )}
                  {subscription.lastPaymentDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Last paid</span>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {formatDay(subscription.lastPaymentDate)}
                      </div>
                    </div>
                  )}
                  {subscription.endDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Ends</span>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {formatDay(subscription.endDate)}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment History */}
              {subscription.payments && subscription.payments.length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-lg">Payment history</CardTitle>
                    <LinkReceiptDialog
                      subscription={subscription}
                      payments={subscription.payments}
                    >
                      <Button variant="outline" size="sm">
                        <LinkIcon className="w-4 h-4 mr-2" />
                        Link receipt
                      </Button>
                    </LinkReceiptDialog>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {subscription.payments.map((payment) => {
                        const bill = billForPayment(payment.id);
                        return (
                        <div
                          key={payment.id}
                          className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            <ReceiptIcon className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">
                                {payment.dueDate ? formatLocalDate(payment.dueDate, DATE_FORMAT, 'en-IE') : formatDay(payment.expectedDate)}
                              </p>
                              <p className="amount text-sm text-muted-foreground">
                                {payment.status === 'paid' && payment.actualAmount
                                  ? `Paid: ${formatCurrency(parseFloat(payment.actualAmount), payment.currency ?? subscription.currency)}`
                                  : `Expected: ${formatCurrency(parseFloat(payment.expectedAmount || '0'), payment.currency ?? subscription.currency)}`}
                              </p>
                            </div>
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
                              {(payment.status === 'paid' && payment.paidVia && PAID_VIA_LABEL[payment.paidVia]) || paymentStatusLabel(payment.status)}
                            </Badge>
                            {bill && (
                              <Button variant="ghost" size="sm" className="h-8" asChild>
                                <a href={`/api/bills/documents/${bill.id}/file`} target="_blank" rel="noopener noreferrer">
                                  <FileText className="w-4 h-4 mr-1" aria-hidden="true" />
                                  Bill
                                </a>
                              </Button>
                            )}
                            {(payment.status === 'pending' || payment.status === 'missed') && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8"
                                  disabled={isUpdatingPayment}
                                  onClick={() => handlePaymentChange(payment, { status: 'paid', actualDate: localToday() }, 'Marked as paid')}
                                  title="Mark paid without a receipt"
                                  aria-label="Mark paid without a receipt"
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Paid
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={isUpdatingPayment}
                                  onClick={() => handlePaymentChange(payment, { status: 'skipped' }, 'Skipped')}
                                  title="Skip this payment"
                                  aria-label="Skip this payment"
                                >
                                  <SkipForward className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {((payment.status === 'paid' && !payment.receiptId) || payment.status === 'skipped') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={isUpdatingPayment}
                                // An assumed direct debit that didn't go out (it bounced) becomes missed, set by
                                // hand, which the daily job leaves alone; back to pending it was assumed paid again.
                                onClick={() => (payment.paidVia === 'assumed'
                                  ? handlePaymentChange(payment, { status: 'missed' }, 'Marked as not gone out')
                                  : handlePaymentChange(payment, { status: 'pending' }, 'Undone'))}
                                title={payment.paidVia === 'assumed' ? "Didn't go out" : 'Undo'}
                                aria-label={payment.paidVia === 'assumed' ? "Didn't go out" : 'Undo'}
                              >
                                <Undo2 className="w-4 h-4" />
                              </Button>
                            )}
                            {payment.receiptId && (
                              <>
                                <Badge variant="outline">
                                  <LinkIcon className="w-3 h-3 mr-1" />
                                  Linked
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleViewReceipt(payment.receiptId!)}
                                  title="View receipt"
                                  aria-label="View receipt"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleUnlinkReceipt(payment.id)}
                                  title="Unlink receipt"
                                  aria-label="Unlink receipt"
                                >
                                  <Unlink className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Bills filed against it, with the file (opens in a new tab: the app can't be framed). */}
              {bills.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Filed bills</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {bills.map((bill) => (
                      <a
                        key={bill.id}
                        href={`/api/bills/documents/${bill.id}/file`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-accent"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{bill.provider ?? bill.fileName ?? 'Bill'}</span>
                            <span className="block text-sm text-muted-foreground">
                              {bill.periodStart && bill.periodEnd
                                ? `For ${formatPeriod(bill.periodStart, bill.periodEnd)}`
                                : bill.issueDate ? `Issued ${formatLocalDate(bill.issueDate, DATE_FORMAT, 'en-IE')}` : 'Bill'}
                              {bill.dueDate && ` · due ${formatLocalDate(bill.dueDate, DATE_FORMAT, 'en-IE')}`}
                            </span>
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {bill.amountDue && (
                            <span className="amount font-semibold">{formatCurrency(parseFloat(bill.amountDue), bill.currency ?? subscription.currency)}</span>
                          )}
                          <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <span className="sr-only">Open the bill</span>
                        </span>
                      </a>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Additional Info */}
              {(subscription.website || subscription.notes) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">More</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {subscription.website && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Website</p>
                        <a
                          href={subscription.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                        >
                          {subscription.website}
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    )}
                    {subscription.notes && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Notes</p>
                        <p className="text-sm">{subscription.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{billsEnabled ? 'Not found' : 'Subscription not found'}</p>
          </div>
        )}
      </DialogContent>

      {/* Edit Subscription Dialog */}
      {subscription && (
        <EditSubscriptionDialog
          subscription={subscription}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}
    </Dialog>
  );
}
