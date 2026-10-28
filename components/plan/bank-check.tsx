'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Landmark, Pencil, Plus } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { formatLocalDate, localToday } from '@/lib/dates/local-date';
import { type AccountWithBalance, useAccounts, useArchiveAccount, useRecordBalances, useSaveAccount } from '@/lib/hooks/use-plan';
import { changedBalances } from '@/lib/plan/balances';
import { toCents } from '@/lib/money';
import { type PlanResponse } from '@/lib/services/plan-service';
import { cn } from '@/lib/utils';
import { formatCents } from '@/lib/utils/currency';
import { ConfirmRemove } from './confirm-remove';
import { ACCOUNT_KIND_LABEL } from './labels';

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
  const short = view !== null && view.availableCents < 0;
  const daysLeft = view ? `${view.daysLeft} day${view.daysLeft === 1 ? '' : 's'} left` : '';
  return (
    <>
      {view ? (
        <Card data-private className="py-0">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Landmark className="h-4 w-4" />{short ? 'Short before payday' : 'Left until payday'}
                </p>
                <p className={cn('amount text-3xl font-semibold tracking-tight', short && 'text-destructive')}>
                  {formatCents(short ? -view.availableCents : view.availableCents, plan.currency)}
                </p>
                {/* A shortfall has nothing to split a week or a day, so only the days are shown. */}
                <p className="amount text-sm text-muted-foreground">
                  {short || view.perWeekCents === null || view.perDayCents === null
                    ? `More goes out than is there · ${daysLeft}`
                    : `${formatCents(view.perWeekCents, plan.currency)} a week · ${formatCents(view.perDayCents, plan.currency)} a day · ${daysLeft}`}
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
                    <span className="text-xs text-muted-foreground">({formatLocalDate(account.asOfDate, { day: 'numeric', month: 'short' }, 'en-IE')})</span>
                  </span>
                  <span className="amount tabular-nums">{formatCents(account.balanceCents, plan.currency)}</span>
                </div>
              ))}
              <p className="amount pt-1 text-xs text-muted-foreground">
                {view.incomingCents > 0 && `+ ${formatCents(view.incomingCents, plan.currency)} still to come in · `}
                − {formatCents(view.outgoingCents, plan.currency)} still to go out
              </p>
              {plan.flags.includes('stale_balance') && (
                <p className="text-xs text-warning">A balance is over a week old or from before this period: update it for a true figure.</p>
              )}
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

type AccountKind = 'current' | 'savings' | 'cash';

/** The editable parts of an account in the dialog's "Edit accounts" mode. */
type AccountEdit = { name: string; kind: AccountKind; includeInPlan: boolean };

function asKind(kind: string): AccountKind {
  return kind === 'savings' || kind === 'cash' ? kind : 'current';
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
  const { mutateAsync: archiveAccount, isPending: archiving } = useArchiveAccount();
  const [values, setValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [edits, setEdits] = useState<Record<string, AccountEdit>>({});
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [newKind, setNewKind] = useState<AccountKind>('current');
  const [newCounted, setNewCounted] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fill the form when it opens, and keep what's been typed when the accounts refetch (one archived,
  // the window refocused): only accounts it hasn't seen yet are filled in. Closing clears it.
  useEffect(() => {
    if (!open) {
      setValues({});
      setEdits({});
      setEditing(false);
      setNewName('');
      setNewBalance('');
      setNewKind('current');
      setNewCounted(true);
      return;
    }
    setValues((typed) => Object.fromEntries(accounts.map((account) => [account.id, typed[account.id] ?? account.latestBalance?.balance ?? ''])));
    setEdits((typed) => Object.fromEntries(accounts.map((account) => [
      account.id,
      typed[account.id] ?? { name: account.name, kind: asKind(account.kind), includeInPlan: account.includeInPlan },
    ])));
    setNewName((typed) => typed || (accounts.length === 0 ? 'Current account' : ''));
  }, [open, accounts]);

  const changedAccounts = (account: AccountWithBalance) => {
    const edit = edits[account.id];
    if (!edit) return null;
    const name = edit.name.trim();
    const changes: Partial<AccountEdit> = {};
    if (name && name !== account.name) changes.name = name;
    if (edit.kind !== account.kind) changes.kind = edit.kind;
    if (edit.includeInPlan !== account.includeInPlan) changes.includeInPlan = edit.includeInPlan;
    return Object.keys(changes).length > 0 ? changes : null;
  };

  const save = async () => {
    setSaving(true);
    const today = localToday();
    try {
      // Only what was changed: re-saving every balance moved untouched accounts' dates to today.
      const balances = changedBalances(accounts, values, today);
      if (balances.length > 0) await recordBalances(balances);
      for (const account of accounts) {
        const changes = changedAccounts(account);
        if (changes) await saveAccount({ id: account.id, data: changes });
      }
      if (newName.trim() && newBalance.trim()) {
        if (toCents(newBalance) === null) throw new Error('Enter the balance as a number');
        await saveAccount({
          data: { name: newName.trim(), kind: newKind, includeInPlan: newCounted, balance: newBalance.trim(), asOfDate: today, householdId: householdId ?? null },
        });
      }
      toast.success('Balances updated');
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save balances');
    } finally {
      setSaving(false);
    }
  };

  const archive = async (account: AccountWithBalance) => {
    try {
      await archiveAccount(account.id);
      toast.success(`${account.name} archived`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to archive it');
    }
  };

  const edit = (id: string, change: Partial<AccountEdit>) => setEdits({ ...edits, [id]: { ...edits[id], ...change } });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Today&apos;s balances</DialogTitle>
          <DialogDescription>
            Type in what your banking app shows now. Only the ones you change are updated. Accounts that aren&apos;t counted (savings, usually) are left out of what&apos;s left to spend.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3" data-private>
          {accounts.map((account) => (
            editing ? (
              <div key={account.id} className="space-y-2 rounded-lg border p-3">
                <div className="grid grid-cols-[1fr_8rem] gap-2">
                  <Input
                    value={edits[account.id]?.name ?? account.name}
                    onChange={(e) => edit(account.id, { name: e.target.value })}
                    aria-label={`Name of ${account.name}`}
                    maxLength={100}
                  />
                  <Select value={edits[account.id]?.kind ?? asKind(account.kind)} onValueChange={(kind) => edit(account.id, { kind: kind as AccountKind })}>
                    <SelectTrigger aria-label={`Kind of ${account.name}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACCOUNT_KIND_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-normal">
                    <Switch
                      checked={edits[account.id]?.includeInPlan ?? account.includeInPlan}
                      onCheckedChange={(includeInPlan) => edit(account.id, { includeInPlan })}
                    />
                    Count it in what&apos;s left
                  </Label>
                  <ConfirmRemove
                    label="Archive"
                    question={`Archive ${account.name}?`}
                    disabled={archiving}
                    resetKey={`${open}-${account.id}`}
                    onConfirm={() => archive(account)}
                  />
                </div>
              </div>
            ) : (
              <div key={account.id} className="grid grid-cols-[1fr_9rem] items-center gap-3">
                <Label htmlFor={`balance-${account.id}`} className="block font-normal">
                  {account.name}
                  <span className="block text-xs text-muted-foreground">
                    {[
                      ACCOUNT_KIND_LABEL[account.kind] ?? account.kind,
                      !account.includeInPlan && 'not counted',
                      account.latestBalance && `as of ${formatLocalDate(account.latestBalance.asOfDate, { day: 'numeric', month: 'short' }, 'en-IE')}`,
                    ].filter(Boolean).join(' · ')}
                  </span>
                </Label>
                <Input
                  id={`balance-${account.id}`}
                  value={values[account.id] ?? ''}
                  onChange={(e) => setValues({ ...values, [account.id]: e.target.value })}
                  inputMode="decimal"
                  className="amount text-right"
                />
              </div>
            )
          ))}
          {accounts.length > 0 && (
            <Button type="button" variant="ghost" size="sm" className="h-11 px-2" onClick={() => setEditing(!editing)}>
              <Pencil className="mr-1.5 h-4 w-4" />{editing ? 'Back to balances' : 'Rename, change or archive accounts'}
            </Button>
          )}
          {!editing && (
            <div className="space-y-2 border-t pt-3">
              <div className="grid grid-cols-[1fr_9rem] items-center gap-3">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add an account" aria-label="New account name" maxLength={100} />
                <Input
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  placeholder={formatCents(0, currency)}
                  inputMode="decimal"
                  className="amount text-right"
                  aria-label="New account balance"
                />
              </div>
              {newName.trim() && (
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    value={newKind}
                    onValueChange={(kind) => {
                      setNewKind(kind as AccountKind);
                      // A savings account isn't spending money: off by default, as the API does.
                      setNewCounted(kind !== 'savings');
                    }}
                  >
                    <SelectTrigger className="w-40" aria-label="New account kind"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACCOUNT_KIND_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-normal">
                    <Switch checked={newCounted} onCheckedChange={setNewCounted} />
                    Count it in what&apos;s left
                  </Label>
                </div>
              )}
              {accounts.length > 0 && !newName.trim() && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><Plus className="h-3 w-3" />Add another account by naming it above.</p>
              )}
            </div>
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
