'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Receipt, Home, Calendar, Mail, Eye, AlertCircle, Briefcase, Tag, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ReceiptCardProps {
  receipt: {
    id: string
    merchantName: string
    totalAmount: string
    currency: string
    transactionDate: string
    userEmail: string
    householdName: string | null
    processingStatus: string
    processingError?: string | null
    category?: string | null
    isBusinessExpense?: boolean | null
    createdAt: string
  }
  onOpenReceipt: (receiptId: string) => void
  onDeleted?: () => void
}

export function ReceiptCard({ receipt, onOpenReceipt, onDeleted }: ReceiptCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteBlob, setDeleteBlob] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const url = `/api/admin/receipts/${receipt.id}${deleteBlob ? '?deleteBlob=true' : ''}`;
      const response = await fetch(url, { method: 'DELETE' });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete receipt');
      }

      toast.success('Receipt deleted successfully');
      setShowDeleteDialog(false);
      onDeleted?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete receipt');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
    <div
      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border p-4 hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => onOpenReceipt(receipt.id)}
    >
      <div className="space-y-1.5 flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium break-all">{receipt.merchantName || 'Unknown Merchant'}</span>
          <Badge
            variant={
              receipt.processingStatus === 'completed'
                ? 'default'
                : receipt.processingStatus === 'failed'
                ? 'destructive'
                : 'secondary'
            }
            className="shrink-0"
          >
            {receipt.processingStatus}
          </Badge>
          {receipt.processingStatus === 'failed' && receipt.processingError && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">{receipt.processingError}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {receipt.isBusinessExpense && (
            <Badge variant="outline" className="gap-1 shrink-0 border-info/30 bg-info/10 text-info">
              <Briefcase className="h-3 w-3" />
              Business
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            <span className="truncate">{receipt.userEmail}</span>
          </span>
          {receipt.householdName && (
            <span className="flex items-center gap-1">
              <Home className="h-3 w-3" />
              <span className="truncate">{receipt.householdName}</span>
            </span>
          )}
          {receipt.category && (
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              <span className="capitalize">{receipt.category}</span>
            </span>
          )}
          <span className="flex items-center gap-1 whitespace-nowrap">
            <Calendar className="h-3 w-3" />
            {new Date(receipt.transactionDate || receipt.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 self-end sm:self-auto">
        <div className="text-right">
          <div className="text-lg font-semibold whitespace-nowrap">
            {receipt.currency || '€'} {receipt.totalAmount || '0.00'}
          </div>
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            Uploaded {new Date(receipt.createdAt).toLocaleDateString()}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteDialog(true);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Eye className="h-5 w-5 text-muted-foreground shrink-0" />
      </div>
    </div>

    {/* Delete Dialog */}
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Receipt</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this receipt from {receipt.userEmail}?
            This action will soft-delete the receipt from the database.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="delete-blob"
              checked={deleteBlob}
              onCheckedChange={(checked) => setDeleteBlob(checked === true)}
            />
            <Label htmlFor="delete-blob" className="text-sm">
              Also delete the image from storage (permanent)
            </Label>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Delete Receipt
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
