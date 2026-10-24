'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface DeleteReceiptButtonProps {
  receiptId: string
  onDeleted: () => void
}

export function DeleteReceiptButton({ receiptId, onDeleted }: DeleteReceiptButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/receipts/${receiptId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete receipt');
      }

      // Invalidate all receipt-related queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['receipt', receiptId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['spending-trends'] });
      queryClient.invalidateQueries({ queryKey: ['spending-summary'] });
      queryClient.invalidateQueries({ queryKey: ['top-items'] });

      toast.success('Receipt deleted successfully');
      onDeleted();
    } catch (error) {
      console.error('Error deleting receipt:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete receipt');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isDeleting}>
          {isDeleting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 mr-2" />
          )}
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete receipt</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this receipt? This action cannot be undone.
            The receipt will be removed from all households it's shared with.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete receipt
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
