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
import { type SavingsGoal } from '@/lib/db/schema';
import { useDeleteGoal, useSaveGoal } from '@/lib/hooks/use-plan';

type GoalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: SavingsGoal | null;
  householdId?: string;
};

/** A savings goal: what you put aside each period (a line in the plan), and optionally a target and date. */
export function GoalDialog({ open, onOpenChange, goal, householdId }: GoalDialogProps) {
  const [name, setName] = useState('Savings');
  const [perCycle, setPerCycle] = useState('');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [saved, setSaved] = useState('');
  const { mutate: saveGoal, isPending } = useSaveGoal();
  const { mutate: deleteGoal, isPending: deleting } = useDeleteGoal();

  useEffect(() => {
    if (!open) return;
    setName(goal?.name ?? 'Savings');
    setPerCycle(goal?.contributionPerCycle ?? '');
    setTarget(goal?.targetAmount ?? '');
    setTargetDate(goal?.targetDate ?? '');
    setSaved(goal?.savedAmount ?? '');
  }, [open, goal]);

  const save = () => {
    saveGoal(
      {
        id: goal?.id,
        data: {
          name: name.trim() || 'Savings',
          contributionPerCycle: perCycle || null,
          targetAmount: target || null,
          targetDate: targetDate || null,
          savedAmount: saved || '0',
          ...(goal ? {} : { householdId: householdId ?? null }),
        },
      },
      {
        onSuccess: () => {
          toast.success(goal ? 'Goal updated' : 'Goal added');
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{goal ? `Edit ${goal.name}` : 'Add savings'}</DialogTitle>
          <DialogDescription>
            What you put aside each period shows in the plan. Tick it off when it&apos;s moved, and it adds to what&apos;s saved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4" data-private>
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal-name">Name</Label>
              <Input id="goal-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="House deposit" maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-per-cycle">Each month</Label>
              <Input id="goal-per-cycle" value={perCycle} onChange={(e) => setPerCycle(e.target.value)} inputMode="decimal" placeholder="0.00" className="amount text-right" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal-target">Target (optional)</Label>
              <Input id="goal-target" value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" className="amount text-right" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-date">By (optional)</Label>
              <Input id="goal-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-saved">Saved so far</Label>
            <Input id="goal-saved" value={saved} onChange={(e) => setSaved(e.target.value)} inputMode="decimal" placeholder="0.00" className="amount text-right" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {goal ? (
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={deleting}
              onClick={() => deleteGoal(goal.id, {
                onSuccess: () => {
                  toast.success(`Removed ${goal.name}`);
                  onOpenChange(false);
                },
                onError: (error) => toast.error(error.message),
              })}
            >
              Remove
            </Button>
          ) : <span />}
          <Button onClick={save} disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
