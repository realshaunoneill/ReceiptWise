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
import { type SavingsGoal } from '@/lib/db/schema';
import { formatLocalDate } from '@/lib/dates/local-date';
import { type GoalInput, useAccounts, useDeleteGoal, useSaveGoal } from '@/lib/hooks/use-plan';
import { toCents } from '@/lib/money';
import { formatCents } from '@/lib/utils/currency';
import { ConfirmRemove } from './confirm-remove';

type GoalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: SavingsGoal | null;
  householdId?: string;
};

/** GoalInput plus the account it's saved in (the hook's type predates it). */
type GoalData = Partial<GoalInput> & { linkedAccountId?: string | null };

const TYPED_IN = 'typed';

/**
 * A savings goal: what you put aside each period (a line in the plan), and optionally a target and
 * date. What's saved is typed in, or read from the savings account it's kept in: the goal had a
 * linked account in the data, but nothing set it and the plan never read it.
 */
export function GoalDialog({ open, onOpenChange, goal, householdId }: GoalDialogProps) {
  const [name, setName] = useState('Savings');
  const [perCycle, setPerCycle] = useState('');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [saved, setSaved] = useState('');
  const [linked, setLinked] = useState(TYPED_IN);
  const { data: accounts = [] } = useAccounts(householdId);
  const { mutate: saveGoal, isPending } = useSaveGoal();
  const { mutate: deleteGoal, isPending: deleting } = useDeleteGoal();

  useEffect(() => {
    if (!open) return;
    setName(goal?.name ?? 'Savings');
    setPerCycle(goal?.contributionPerCycle ?? '');
    setTarget(goal?.targetAmount ?? '');
    setTargetDate(goal?.targetDate ?? '');
    setSaved(goal?.savedAmount ?? '');
    setLinked(goal?.linkedAccountId ?? TYPED_IN);
  }, [open, goal]);

  // Savings accounts first: they're where a goal's money usually sits.
  const choices = accounts
    .filter((account) => !account.archivedAt)
    .sort((a, b) => Number(b.kind === 'savings') - Number(a.kind === 'savings'));
  const linkedAccount = choices.find((account) => account.id === linked);
  const linkedBalance = linkedAccount?.latestBalance ? toCents(linkedAccount.latestBalance.balance) : null;

  const save = () => {
    const data: GoalData = {
      name: name.trim() || 'Savings',
      contributionPerCycle: perCycle || null,
      targetAmount: target || null,
      targetDate: targetDate || null,
      savedAmount: saved || '0',
      linkedAccountId: linked === TYPED_IN ? null : linked,
      ...(goal ? {} : { householdId: householdId ?? null }),
    };
    saveGoal(
      { id: goal?.id, data },
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
          {(choices.length > 0 || linked !== TYPED_IN) && (
            <div className="space-y-1.5">
              <Label htmlFor="goal-account">Where it&apos;s saved</Label>
              <Select value={linked} onValueChange={setLinked}>
                <SelectTrigger id="goal-account"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TYPED_IN}>Not linked to an account</SelectItem>
                  {choices.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}
                  {linked !== TYPED_IN && !linkedAccount && <SelectItem value={linked}>Another account</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          )}
          {linked === TYPED_IN || !linkedAccount || linkedBalance === null ? (
            <div className="space-y-1.5">
              <Label htmlFor="goal-saved">Saved so far</Label>
              <Input id="goal-saved" value={saved} onChange={(e) => setSaved(e.target.value)} inputMode="decimal" placeholder="0.00" className="amount text-right" />
              {linkedAccount && <p className="text-xs text-muted-foreground">{linkedAccount.name} has no balance yet; this is used until it does.</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Saved so far is {linkedAccount.name}&apos;s balance, <span className="amount">{formatCents(linkedBalance, linkedAccount.currency)}</span> on{' '}
              {formatLocalDate(linkedAccount.latestBalance!.asOfDate, { day: 'numeric', month: 'short' }, 'en-IE')}, plus anything ticked off since.
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {goal ? (
            <ConfirmRemove
              resetKey={open && goal.id}
              question={`Remove ${goal.name}?`}
              disabled={deleting}
              onConfirm={() => deleteGoal(goal.id, {
                onSuccess: () => {
                  toast.success(`Removed ${goal.name}`);
                  onOpenChange(false);
                },
                onError: (error) => toast.error(error.message),
              })}
            />
          ) : <span />}
          <Button onClick={save} disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
