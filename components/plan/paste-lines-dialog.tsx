'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useCreateSubscription } from '@/hooks/use-subscriptions';
import { useCreateEntries } from '@/lib/hooks/use-plan';
import { toCents } from '@/lib/money';
import { firstBillDate } from '@/lib/plan/new-bill';
import { parseLines } from '@/lib/plan/parse-lines';
import { type PlanResponse } from '@/lib/services/plan-service';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/currency';
import { PAYMENT_METHOD_LABEL, PAYMENT_METHOD_OPTIONS, type PaymentMethodOption, TAP_TARGET } from './labels';
import { defaultBillDay, defaultEntryDate } from './quick-add';

type PasteLinesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PlanResponse;
  householdId?: string;
};

/**
 * Add many lines at once: type them, or copy the label and amount columns out of a spreadsheet
 * (one tab per month, as Megan keeps hers) and paste. Each line can be marked monthly, which makes
 * it a recurring bill rather than a one-off. Lines with no amount are left out.
 *
 * A pasted sheet repeats the regular bills (Rent, Car…) that are already in the plan, and adding
 * them again as one-offs counted them twice. A line named like a bill in the period starts unticked.
 */
export function PasteLinesDialog({ open, onOpenChange, plan, householdId }: PasteLinesDialogProps) {
  const [text, setText] = useState('');
  // Lines whose tick was changed from the default (on, or off for a line that's already a bill).
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [monthly, setMonthly] = useState<Set<number>>(new Set());
  const [billDay, setBillDay] = useState('');
  const [method, setMethod] = useState<PaymentMethodOption>('direct_debit');
  const [saving, setSaving] = useState(false);
  const { mutateAsync: createEntries } = useCreateEntries();
  const { mutateAsync: createSubscription } = useCreateSubscription();

  const parsed = useMemo(() => parseLines(text), [text]);
  const bills = useMemo(
    () => new Set(plan.lines.filter((line) => line.source === 'recurring').map((line) => line.label.trim().toLowerCase())),
    [plan.lines],
  );
  const withAmount = parsed
    .map((line, index) => ({
      ...line,
      index,
      cents: line.amount === null ? null : toCents(line.amount),
      isBill: bills.has(line.label.trim().toLowerCase()),
    }))
    .filter((line) => line.cents !== null && line.cents > 0);
  const isChosen = (line: { index: number; isBill: boolean }) => line.isBill === flipped.has(line.index);
  const chosen = withAmount.filter(isChosen);
  const skipped = parsed.length - withAmount.length;
  const month = plan.period.label.split(' ')[0];

  const toggle = (set: Set<number>, index: number, setter: (next: Set<number>) => void) => {
    const next = new Set(set);
    if (next.has(index)) next.delete(index); else next.add(index);
    setter(next);
  };

  const close = () => {
    onOpenChange(false);
    setText('');
    setFlipped(new Set());
    setMonthly(new Set());
    setBillDay('');
    setMethod('direct_debit');
  };

  const anyMonthly = chosen.some((line) => monthly.has(line.index));

  const save = async () => {
    if (chosen.length === 0) return;
    const day = billDay.trim() ? Number(billDay) : defaultBillDay(plan);
    if (anyMonthly && (!Number.isInteger(day) || day < 1 || day > 31)) {
      toast.error('Pick a day of the month from 1 to 31');
      return;
    }
    setSaving(true);
    const date = defaultEntryDate(plan);
    try {
      const oneOffs = chosen.filter((line) => !monthly.has(line.index));
      const newBills = chosen.filter((line) => monthly.has(line.index));
      if (oneOffs.length > 0) {
        await createEntries(oneOffs.map((line) => ({ date, label: line.label, amount: line.amount!, householdId: householdId ?? null })));
      }
      // The same day and payment method as quick add: before, these took the period's first day
      // and no method, so they counted as paid by hand and went overdue.
      for (const line of newBills) {
        await createSubscription({
          name: line.label,
          amount: line.amount!,
          currency: plan.currency,
          billingFrequency: 'monthly',
          billingDay: day,
          startDate: firstBillDate(plan.period, day),
          kind: 'bill',
          paymentMethod: method,
          householdId,
        });
      }
      toast.success(`Added ${chosen.length} to ${month}${newBills.length > 0 ? `, ${newBills.length} as monthly bills` : ''}`);
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add them');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paste a list into {month}</DialogTitle>
          <DialogDescription>
            One per line, like &ldquo;Rent 150&rdquo;, or copy the two columns straight out of your spreadsheet.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFlipped(new Set());
            setMonthly(new Set());
          }}
          placeholder={'Rent 150\nCar 469\nBirthday present 40'}
          rows={6}
          className="font-mono text-sm"
          aria-label="Lines to add"
        />

        {withAmount.length > 0 && (
          <div className="space-y-1" data-private>
            <div className="flex justify-between px-1 text-xs text-muted-foreground">
              <span>Add</span>
              <span>Every month</span>
            </div>
            <ul className="divide-y rounded-md border">
              {withAmount.map((line) => (
                <li key={line.index} className="flex min-h-12 items-center gap-4 px-4 py-2">
                  <Checkbox
                    checked={isChosen(line)}
                    onCheckedChange={() => toggle(flipped, line.index, setFlipped)}
                    aria-label={`Add ${line.label}`}
                    className={TAP_TARGET}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate', !isChosen(line) && 'text-muted-foreground')}>{line.label}</span>
                    {line.isBill && <span className="block text-xs text-muted-foreground">Already a bill in {month}</span>}
                  </span>
                  <span className="amount tabular-nums">{formatCurrency(line.cents! / 100, plan.currency)}</span>
                  <Checkbox
                    checked={monthly.has(line.index)}
                    disabled={!isChosen(line)}
                    onCheckedChange={() => toggle(monthly, line.index, setMonthly)}
                    aria-label={`${line.label} every month`}
                    className={TAP_TARGET}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
        {anyMonthly && (
          <div className="grid grid-cols-[6rem_1fr] gap-2">
            <div className="space-y-1">
              <Label htmlFor="paste-day" className="text-xs text-muted-foreground">Day of the month</Label>
              <Input
                id="paste-day"
                type="number"
                min={1}
                max={31}
                inputMode="numeric"
                value={billDay}
                placeholder={String(defaultBillDay(plan))}
                onChange={(e) => setBillDay(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="paste-method" className="text-xs text-muted-foreground">Monthly ones paid by</Label>
              <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethodOption)}>
                <SelectTrigger id="paste-method" className="h-11 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>{PAYMENT_METHOD_LABEL[option]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {skipped > 0 && (
          <p className="text-xs text-muted-foreground">
            {skipped} line{skipped === 1 ? '' : 's'} with no amount left out.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || chosen.length === 0}>
            {saving ? 'Adding…' : `Add ${chosen.length || ''}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
