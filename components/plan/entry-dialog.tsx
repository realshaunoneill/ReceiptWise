'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useDeleteEntry, useUpdateEntry } from '@/lib/hooks/use-plan';
import { fromCents } from '@/lib/money';
import { type PlanLine } from '@/lib/plan/compute-plan';
import { ConfirmRemove } from './confirm-remove';

type EntryDialogProps = {
  line: PlanLine | null;
  onOpenChange: (open: boolean) => void;
};

/**
 * Edit a one-off line: its label, amount, date (which decides its period), whether it's money in
 * or out, its category and notes. Notes used to be saved but never shown again, and a cleared
 * field was never sent, so it couldn't be emptied.
 */
export function EntryDialog({ line, onOpenChange }: EntryDialogProps) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const { mutate: updateEntry, isPending } = useUpdateEntry();
  const { mutate: deleteEntry, isPending: deleting } = useDeleteEntry();

  useEffect(() => {
    if (!line) return;
    setLabel(line.label);
    setAmount(fromCents(line.amountCents));
    setDate(line.date);
    setDirection(line.direction);
    setCategory(line.category ?? '');
    setNotes(line.notes ?? '');
  }, [line]);

  const save = () => {
    if (!line) return;
    updateEntry(
      {
        id: line.sourceId,
        data: { label, amount, date, direction, category: category.trim() || null, notes: notes.trim() || null },
      },
      {
        onSuccess: () => {
          toast.success('Saved');
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Dialog open={Boolean(line)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {line?.label}</DialogTitle>
          <DialogDescription>A one-off line. Its date decides which period it&apos;s in.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4" data-private>
          <div className="space-y-1.5">
            <Label htmlFor="entry-label">What for</Label>
            <Input id="entry-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="entry-amount">Amount</Label>
              <Input id="entry-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="amount text-right" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entry-date">Date</Label>
              <Input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="entry-direction">Money</Label>
              <Select value={direction} onValueChange={(value) => setDirection(value as 'out' | 'in')}>
                <SelectTrigger id="entry-direction"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="out">Going out</SelectItem>
                  <SelectItem value="in">Coming in</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entry-category">Category</Label>
              <Input id="entry-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Optional" maxLength={50} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entry-notes">Notes</Label>
            <Textarea id="entry-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <ConfirmRemove
            resetKey={line?.key}
            question={`Remove ${line?.label ?? 'it'}?`}
            disabled={deleting || !line}
            onConfirm={() => line && deleteEntry(line.sourceId, {
              onSuccess: () => {
                toast.success(`Removed ${line.label}`);
                onOpenChange(false);
              },
              onError: (error) => toast.error(error.message),
            })}
          />
          <Button onClick={save} disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
