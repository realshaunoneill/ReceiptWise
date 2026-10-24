'use client';

import { useState } from 'react';
import { Briefcase, Check } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

type BusinessExpenseDialogProps = {
  receiptId: string;
  isBusinessExpense: boolean;
  businessCategory?: string | null;
  businessNotes?: string | null;
  taxDeductible: boolean;
};

const businessCategories = [
  'Office Supplies',
  'Software & Tools',
  'Travel',
  'Meals & Entertainment',
  'Equipment',
  'Marketing',
  'Professional Services',
  'Utilities',
  'Insurance',
  'Other',
];

export function BusinessExpenseDialog({
  receiptId,
  isBusinessExpense,
  businessCategory,
  businessNotes,
  taxDeductible,
}: BusinessExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(isBusinessExpense);
  const [category, setCategory] = useState(businessCategory || '');
  const [notes, setNotes] = useState(businessNotes || '');
  const [deductible, setDeductible] = useState(taxDeductible);
  const queryClient = useQueryClient();

  const { mutate: updateReceipt, isPending } = useMutation({
    mutationFn: async (data: {
      isBusinessExpense: boolean;
      businessCategory?: string;
      businessNotes?: string;
      taxDeductible: boolean;
    }) => {
      const res = await fetch(`/api/receipts/${receiptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update receipt');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt', receiptId] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      toast.success(
        enabled
          ? 'Receipt marked as business expense'
          : 'Business expense status removed',
      );
      setOpen(false);
    },
    onError: () => {
      toast.error('Failed to update. Please try again.');
    },
  });

  const handleSave = () => {
    updateReceipt({
      isBusinessExpense: enabled,
      businessCategory: enabled ? category || undefined : undefined,
      businessNotes: enabled ? notes || undefined : undefined,
      taxDeductible: enabled ? deductible : false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isBusinessExpense ? (
          <Badge
            variant="secondary"
            className="flex items-center gap-1 cursor-pointer hover:bg-secondary/80"
          >
            <Briefcase className="h-3 w-3" />
            Business expense
            {taxDeductible && <Check className="h-3 w-3 ml-1" />}
          </Badge>
        ) : (
          <Button variant="outline" size="sm">
            <Briefcase className="h-4 w-4 mr-2" />
            Mark as business
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Business expense</DialogTitle>
          <DialogDescription>
            Mark this receipt as a business expense for tax tracking and reporting.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="business-toggle">Business expense</Label>
              <p className="text-sm text-muted-foreground">
                Track this receipt for business purposes
              </p>
            </div>
            <Switch
              id="business-toggle"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Select a category</option>
                  {businessCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add notes about this business expense"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="tax-deductible">Tax deductible</Label>
                  <p className="text-sm text-muted-foreground">
                    Mark this as a tax-deductible expense
                  </p>
                </div>
                <Switch
                  id="tax-deductible"
                  checked={deductible}
                  onCheckedChange={setDeductible}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
