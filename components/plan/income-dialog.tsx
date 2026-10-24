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
import { Switch } from '@/components/ui/switch';
import { type IncomeSource } from '@/lib/db/schema';
import { localToday } from '@/lib/dates/local-date';
import { type IncomeInput, useAccounts, useDeleteIncome, useSaveIncome } from '@/lib/hooks/use-plan';
import { ConfirmRemove } from './confirm-remove';

type IncomeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing this one; otherwise adding a new income. */
  income?: IncomeSource | null;
  /**
   * The first income is the primary one, which sets the plan's period: true when the viewer has
   * no primary income in any scope (or is editing their only one). Basing it on one scope's list
   * made a household plan treat someone with a salary as having none.
   */
  isFirst: boolean;
  /** The viewer's current primary income, whatever the scope, so making another primary says what it replaces. */
  currentPrimary?: { id: string; name: string } | null;
  householdId?: string;
};

/** IncomeInput plus the account it's paid into (the hook's type predates it). */
type IncomeData = Partial<IncomeInput> & { intoAccountId?: string | null };

const MAIN_ACCOUNT = 'main';

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly, on a set day' },
  { value: 'last_working_day', label: 'Monthly, last working day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'fortnightly', label: 'Every two weeks' },
  { value: 'four_weekly', label: 'Every four weeks' },
];

const WEEKEND_RULES = [
  { value: 'previous_business_day', label: 'The working day before' },
  { value: 'next_business_day', label: 'The working day after' },
  { value: 'none', label: 'That day anyway' },
];

/** Your pay, and when it lands. The primary income's paydays mark where each period starts. */
export function IncomeDialog({ open, onOpenChange, income, isFirst, currentPrimary, householdId }: IncomeDialogProps) {
  const [name, setName] = useState('Salary');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [payDay, setPayDay] = useState('25');
  const [anchorDate, setAnchorDate] = useState(localToday());
  const [weekendRule, setWeekendRule] = useState('previous_business_day');
  const [isPrimary, setIsPrimary] = useState(true);
  const [intoAccount, setIntoAccount] = useState(MAIN_ACCOUNT);
  const { data: accounts = [] } = useAccounts(householdId);
  const { mutate: saveIncome, isPending } = useSaveIncome();
  const { mutate: deleteIncome, isPending: deleting } = useDeleteIncome();

  useEffect(() => {
    if (!open) return;
    setName(income?.name ?? 'Salary');
    setAmount(income?.amount ?? '');
    setFrequency(income?.frequency ?? 'monthly');
    setPayDay(String(income?.payDay ?? 25));
    setAnchorDate(income?.anchorDate ?? localToday());
    setWeekendRule(income?.weekendRule ?? 'previous_business_day');
    setIsPrimary(income?.isPrimary ?? isFirst);
    setIntoAccount(income?.intoAccountId ?? MAIN_ACCOUNT);
  }, [open, income, isFirst]);

  const weekly = ['weekly', 'fortnightly', 'four_weekly'].includes(frequency);

  const replacesPrimary = isPrimary && !isFirst && currentPrimary && currentPrimary.id !== income?.id ? currentPrimary : null;
  const liveAccounts = accounts.filter((account) => !account.archivedAt);

  const save = () => {
    const data: IncomeData = {
      name: name.trim() || 'Salary',
      amount,
      frequency,
      payDay: frequency === 'monthly' ? Number(payDay) : null,
      anchorDate: weekly ? anchorDate : null,
      weekendRule,
      isPrimary,
      intoAccountId: intoAccount === MAIN_ACCOUNT ? null : intoAccount,
      ...(income ? {} : { householdId: householdId ?? null }),
    };
    saveIncome(
      { id: income?.id, data },
      {
        onSuccess: () => {
          toast.success(income ? 'Income updated' : 'Income added');
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
          <DialogTitle>{income ? 'Edit income' : 'Add your pay'}</DialogTitle>
          <DialogDescription>
            What comes in and when. Your main pay sets the plan: each period runs from one payday to the next.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4" data-private>
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="income-name">Name</Label>
              <Input id="income-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="income-amount">Amount</Label>
              <Input id="income-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="amount text-right" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="income-frequency">How often</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger id="income-frequency"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {frequency === 'monthly' && (
            <div className="space-y-1.5">
              <Label htmlFor="income-day">Day of the month</Label>
              <Input id="income-day" type="number" min={1} max={31} value={payDay} onChange={(e) => setPayDay(e.target.value)} inputMode="numeric" />
            </div>
          )}
          {weekly && (
            <div className="space-y-1.5">
              <Label htmlFor="income-anchor">A day you were paid</Label>
              <Input id="income-anchor" type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
            </div>
          )}

          {frequency !== 'last_working_day' && (
            <div className="space-y-1.5">
              <Label htmlFor="income-weekend">If payday falls on a weekend or bank holiday, it arrives</Label>
              <Select value={weekendRule} onValueChange={setWeekendRule}>
                <SelectTrigger id="income-weekend"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKEND_RULES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {(liveAccounts.length > 0 || intoAccount !== MAIN_ACCOUNT) && (
            <div className="space-y-1.5">
              <Label htmlFor="income-into">Paid into</Label>
              <Select value={intoAccount} onValueChange={setIntoAccount}>
                <SelectTrigger id="income-into"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={MAIN_ACCOUNT}>Your main account</SelectItem>
                  {liveAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}
                  {intoAccount !== MAIN_ACCOUNT && !liveAccounts.some((account) => account.id === intoAccount) && (
                    <SelectItem value={intoAccount}>Another account</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used for what&apos;s left until payday, when you add balances.</p>
            </div>
          )}

          {!isFirst && (
            <div className="space-y-1">
              <Label htmlFor="income-primary" className="flex min-h-11 cursor-pointer items-center gap-2 font-normal">
                <Switch id="income-primary" checked={isPrimary} onCheckedChange={setIsPrimary} />
                My main pay (sets the period)
              </Label>
              {replacesPrimary && (
                <p className="text-xs text-warning">This replaces {replacesPrimary.name} as your main pay, and the periods will follow this one&apos;s paydays.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {income ? (
            <ConfirmRemove
              resetKey={open && income.id}
              question={`Remove ${income.name}?`}
              disabled={deleting}
              onConfirm={() => deleteIncome(income.id, {
                onSuccess: () => {
                  toast.success('Income removed');
                  onOpenChange(false);
                },
                onError: (error) => toast.error(error.message),
              })}
            />
          ) : <span />}
          <Button onClick={save} disabled={isPending || !amount}>{isPending ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
