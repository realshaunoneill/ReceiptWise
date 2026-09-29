'use client';

import { Store, MapPin, Info, Calendar, Clock, CreditCard, Hash, Receipt as ReceiptIcon, Building2, AlertCircle, RefreshCw, Share2, Lock, Home, Upload, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReceiptAssignmentDialog } from '@/components/receipts/receipt-assignment-dialog';
import { DeleteReceiptButton } from './delete-receipt-button';
import { BusinessExpenseDialog } from './business-expense-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { capitalizeText } from '@/lib/utils/format-category';
import { categoryBadgeClasses, getCategory } from '@/lib/utils/categories';
import { ReceiptStatusBadge } from '@/components/receipts/receipt-status-badge';
import type { ReceiptWithItems, OCRData } from '@/lib/types/api-responses';
import { canRetryReceipt, isStuckProcessing } from '@/lib/utils/receipt-status';
import { useState } from 'react';
import { toast } from 'sonner';

interface HouseholdInfo {
  id: string;
  name: string;
  members?: Array<{ userId: string; role: string; email: string }>;
}

interface ReceiptHeaderProps {
  receipt: ReceiptWithItems
  household: HouseholdInfo | null
  isLoadingPermissions: boolean
  canModifyReceipt: boolean
  isReceiptOwner: boolean
  onDeleted: () => void
  onRetrySuccess?: () => void | Promise<void>
}

export function ReceiptHeader({
  receipt,
  household,
  isLoadingPermissions,
  canModifyReceipt,
  isReceiptOwner,
  onDeleted,
  onRetrySuccess,
}: ReceiptHeaderProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const category = getCategory(receipt.category);
  const CategoryIcon = category.icon;

  const handleRetry = async () => {
    setIsRetrying(true);

    try {
      const response = await fetch(`/api/receipts/${receipt.id}/retry`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to retry processing');
      }

      toast.success('Receipt processed successfully! The details have been updated.');

      // Call the callback to refresh the receipt data
      if (onRetrySuccess) {
        await onRetrySuccess();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to retry processing');
    } finally {
      setIsRetrying(false);
    }
  };


  return (
    <div>
      {/* Warning for non-receipt uploads. Was another hand-rolled yellow panel
          (`bg-yellow-50 dark:bg-yellow-950/20`); the Alert warning variant now
          carries it, so it matches every other notice in the app. */}
      {receipt.isReceipt === false && (
        <Alert variant="warning" className="mb-4">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>This doesn&apos;t look like a receipt</AlertTitle>
          <AlertDescription>
            It may be a screenshot or a photo of something else. Anything extracted below
            is likely to be incomplete or wrong.
          </AlertDescription>
        </Alert>
      )}


      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Store className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">
                {receipt.merchantName || 'Unknown Merchant'}
              </h2>
              {receipt.ocrData && typeof receipt.ocrData === 'object' && Object.keys(receipt.ocrData).length > 5 ? (
                <Badge variant="default" className="text-xs">
                  <Info className="h-3 w-3 mr-1" />
                  Enhanced
                </Badge>
              ) : null}
              {receipt.processingStatus && <ReceiptStatusBadge status={receipt.processingStatus} />}
            </div>
            {receipt.location && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {receipt.location}
              </p>
            )}
            {/* Category and Merchant Type */}
            <div className="flex flex-wrap gap-2 mt-2">
              {receipt.category && (
                /* Third place a category badge was rendered, and the third
                   different look: plain grey outline here, coloured in the list
                   and the timeline. All three read the shared table now. */
                <Badge variant="outline" className={categoryBadgeClasses(receipt.category)}>
                  <CategoryIcon className="h-3 w-3" aria-hidden="true" />
                  {category.label}
                </Badge>
              )}
              {(() => {
                const ocrData = receipt.ocrData as OCRData | null;
                return ocrData?.merchantType && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {capitalizeText(ocrData.merchantType)}
                  </Badge>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Current Household Badge and Business Expense Display */}
      <div className="mt-4 flex flex-wrap gap-2">
        {household ? (
          <Badge variant="secondary" className="flex items-center gap-2 w-fit bg-primary/10 text-primary">
            <Home className="h-3 w-3" />
            Shared with {household.name}
          </Badge>
        ) : (
          <Badge variant="outline" className="flex items-center gap-2 w-fit">
            <Lock className="h-3 w-3" />
            Private
          </Badge>
        )}
        {receipt.isBusinessExpense && !isReceiptOwner && (
          <Badge variant="outline" className="flex w-fit items-center gap-2 border-info/30 bg-info/10 text-info">
            <Building2 className="h-3 w-3" />
            Business Expense
            {receipt.taxDeductible && <span className="ml-1">• Tax Deductible</span>}
          </Badge>
        )}
      </div>

      {/* Processing Error Message */}
      {receipt.processingStatus === 'failed' && receipt.processingError && (
        <div className="mt-4 rounded-md border border-destructive/20 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">
            <AlertCircle className="h-4 w-4 inline mr-2" />
            <strong>Processing Error:</strong> {receipt.processingError}
          </p>
        </div>
      )}

      {isStuckProcessing(receipt) && (
        <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3">
          <p className="text-sm text-warning">
            <AlertCircle className="h-4 w-4 inline mr-2" aria-hidden="true" />
            Reading this receipt hasn&apos;t finished.{isReceiptOwner ? ' Try again below.' : ''}
          </p>
        </div>
      )}

      {/* Retry for failed receipts, and for ones whose processing never finished */}
      {canRetryReceipt(receipt) && isReceiptOwner && (
        <div className="mt-4">
          <Button
            onClick={handleRetry}
            disabled={isRetrying}
            variant="default"
            size="sm"
            className="w-full"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Processing
              </>
            )}
          </Button>
        </div>
      )}

      {/* Assignment and Delete Buttons - Show loading state or buttons */}
      <div className="mt-4">
        {isLoadingPermissions ? (
          // Loading skeleton for action buttons
          <div className="flex gap-2">
            <div className="h-9 flex-1 bg-muted animate-pulse rounded-md" />
            <div className="h-9 w-24 bg-muted animate-pulse rounded-md" />
          </div>
        ) : canModifyReceipt ? (
          <div className="flex gap-2">
            <ReceiptAssignmentDialog
              receiptId={receipt.id}
              currentHouseholdId={receipt.householdId || undefined}
              isOwner={isReceiptOwner}
              canRemoveOnly={!isReceiptOwner && !!receipt.householdId}
            >
              <Button variant="outline" size="sm" className="flex-1">
                {!isReceiptOwner && receipt.householdId ? (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Make Private
                  </>
                ) : receipt.householdId ? (
                  <>
                    <Share2 className="h-4 w-4 mr-2" />
                    Change Sharing
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Receipt
                  </>
                )}
              </Button>
            </ReceiptAssignmentDialog>

            {/* Delete Button - Only for receipt owner */}
            {isReceiptOwner && (
              <DeleteReceiptButton
                receiptId={receipt.id}
                onDeleted={onDeleted}
              />
            )}
          </div>
        ) : null}
      </div>

      {/* Meta Info */}
      <div className="flex flex-wrap gap-3 mt-4">
        {/* Receipt/Transaction Date */}
        <Badge variant="secondary" className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {receipt.transactionDate
            ? `Receipt: ${receipt.transactionDate}`
            : `Receipt: ${new Date(receipt.createdAt).toLocaleDateString()}`}
        </Badge>
        {/* Upload Date - only show if different from transaction date */}
        <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground">
          <Upload className="h-3 w-3" />
          Uploaded: {new Date(receipt.createdAt).toLocaleDateString()}
        </Badge>
        {(() => {
          const ocrData = receipt.ocrData as OCRData | null;
          return ocrData?.timeOfDay && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {ocrData.timeOfDay}
            </Badge>
          );
        })()}
        {receipt.paymentMethod && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <CreditCard className="h-3 w-3" />
            {capitalizeText(receipt.paymentMethod)}
          </Badge>
        )}
        {receipt.receiptNumber && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {receipt.receiptNumber}
          </Badge>
        )}
        {(() => {
          const ocrData = receipt.ocrData as OCRData | null;
          return ocrData?.orderNumber && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <ReceiptIcon className="h-3 w-3" />
              Order: {ocrData.orderNumber}
            </Badge>
          );
        })()}
      </div>

      {/* Business Expense Section - Only for receipt owner */}
      {isReceiptOwner && (
        <div className="mt-4">
          <BusinessExpenseDialog
            receiptId={receipt.id}
            isBusinessExpense={receipt.isBusinessExpense || false}
            businessCategory={receipt.businessCategory}
            businessNotes={receipt.businessNotes}
            taxDeductible={receipt.taxDeductible || false}
          />
        </div>
      )}
    </div>
  );
}
