'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Landmark, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { formatLocalDate, localToday } from '@/lib/dates/local-date';
import { useAccounts, useRecordBalances, useSaveAccount } from '@/lib/hooks/use-plan';
import { toCents } from '@/lib/money';
import { type PlanResponse } from '@/lib/services/plan-service';
import { cn } from '@/lib/utils';
import { formatCents } from '@/lib/utils/currency';

type BankCheckProps = {
  plan: PlanResponse;
  householdId?: string;
};

/**
 * The optional second view: from the balance actually in the bank, what is left until payday once
 * everything still to go has gone. Balances are typed in; there is no bank connection. Only shown
 * for the period that contains today.
 */
export function BankCheck({ plan, householdId }: BankCheckProps) {
  const [open, setOpen] = useState(false);
  const isCurrent = plan.daysLeft !== null;
  if (!isCurrent) return null;

  const view = plan.balance;
  return (
    <>
      {view ? (
        <Card data-private>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Landmark className="h-4 w-4" />Left until payday</p>
                <p className={cn('amount text-3xl font-semibold tracking-tight', view.availableCents < 0 && 'text-destructive')}>
                  {formatCents(view.availableCents, plan.currency)}
                </p>
                <p className="amount text-sm text-muted-foreground">
                  {formatCents(view.perWeekCents, plan.currency)} a week · {formatCents(view.perDayCents, plan.currency)} a day · {view.daysLeft} day{view.daysLeft === 1 ? '' : 's'} left
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Update</Button>
            </div>
            <div className="space-y-1 border-t pt-3 text-sm">
              {view.accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between gap-2">
                  <span className={cn('flex items-center gap-1.5', account.stale && 'text-warning')}>
                    {account.stale && <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
                    {account.name}
                    <span className="text-xs text-muted-foreground">({formatLocalDate(account.asOfDate, { day: 'numeric', month: 'short' })})</span>
                  </span>
                  <span className="amount tabular-nums">{formatCents(account.balanceCents, plan.currency)}</span>
                </div>
              ))}
              <p className="amount pt-1 text-xs text-muted-foreground">
                {view.incomingCents > 0 && `+ ${formatCents(view.incomingCents, plan.currency)} still to come in · `}
                − {formatCents(view.outgoingCents, plan.currency)} still to go out
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed p-4 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <Landmark className="h-5 w-5 shrink-0" />
          <span>Check it against your bank: add today&apos;s balance to see what&apos;s actually left until payday.</span>
        </button>
      )}
      <UpdateBalancesDialog open={open} onOpenChange={setOpen} householdId={householdId} currency={plan.currency} />
    </>
  );
}

function UpdateBalancesDialog({
  open,
  onOpenChange,
  householdId,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId?: string;
  currency: string;
}) {
  const { data: accounts = [] } = useAccounts(householdId);
  const { mutateAsync: recordBalances } = useRecordBalances();
  const { mutateAsync: saveAccount } = useSaveAccount();
  const [values, setValues] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(Object.fromEntries(accounts.map((account) => [account.id, account.latestBalance?.balance ?? ''])));
    setNewName(accounts.length === 0 ? 'Current account' : '');
    setNewBalance('');
  }, [open, accounts]);

  const save = async () => {
    setSaving(true);
    const today = localToday();
    try {
      const changed = accounts
        .filter((account) => values[account.id]?.trim() && toCents(values[account.id]) !== null)
        .map((account) => ({ accountId: account.id, balance: values[account.id].trim(), asOfDate: today }));
      if (changed.length > 0) await recordBalances(changed);
      if (newName.trim() && newBalance.trim()) {
        if (toCents(newBalance) === null) throw new Error('Enter the balance as a number');
        await saveAccount({ data: { name: newName.trim(), kind: 'current', balance: newBalance.trim(), asOfDate: today, householdId: householdId ?? null } });
      }
      toast.success('Balances updated');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save balances');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Today&apos;s balances</DialogTitle>
          <DialogDescription>
            Type in what your banking app shows now. Savings accounts are left out of what&apos;s left to spend.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3" data-private>
          {accounts.map((account) => (
            <div key={account.id} className="grid grid-cols-[1fr_9rem] items-center gap-3">
              <Label htmlFor={`balance-${account.id}`} className="font-normal">
                {account.name}
                {!account.includeInPlan && <span className="block text-xs text-muted-foreground">Not counted</span>}
              </Label>
              <Input
                id={`balance-${account.id}`}
                value={values[account.id] ?? ''}
                onChange={(e) => setValues({ ...values, [account.id]: e.target.value })}
                inputMode="decimal"
                className="amount text-right"
              />
            </div>
          ))}
          <div className="grid grid-cols-[1fr_9rem] items-center gap-3 border-t pt-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add an account" aria-label="New account name" />
            <Input
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
              placeholder={formatCents(0, currency)}
              inputMode="decimal"
              className="amount text-right"
              aria-label="New account balance"
            />
          </div>
          {accounts.length > 0 && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><Plus className="h-3 w-3" />Add another account by naming it above.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
