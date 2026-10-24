'use client';

import { useRef, useState } from 'react';
import { ClipboardPaste, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCreateSubscription } from '@/hooks/use-subscriptions';
import { localToday } from '@/lib/dates/local-date';
import { useCreateEntries } from '@/lib/hooks/use-plan';
import { fromCents, toCents } from '@/lib/money';
import { firstBillDate } from '@/lib/plan/new-bill';
import { type PlanResponse } from '@/lib/services/plan-service';
import { cn } from '@/lib/utils';
import { formatCents } from '@/lib/utils/currency';
import { PAYMENT_METHOD_LABEL, PAYMENT_METHOD_OPTIONS, type PaymentMethodOption, TAP_TARGET } from './labels';
import { PasteLinesDialog } from './paste-lines-dialog';

/** The day new lines are dated: today if it's in the period being viewed, else its first day. */
export function defaultEntryDate(plan: PlanResponse): string {
  const today = localToday();
  return today >= plan.period.start && today < plan.period.end ? today : plan.period.start;
}

/** The day of the month a new monthly bill defaults to: the day it's added on (or the period's first day). */
export function defaultBillDay(plan: PlanResponse): number {
  return Number(defaultEntryDate(plan).slice(8, 10));
}

type QuickAddProps = {
  plan: PlanResponse;
  householdId?: string;
};

/**
 * Add a line to the period the way you'd type it into the sheet: a label and an amount. "Every
 * month" makes it a recurring bill instead, on the day of the month and paid the way you pick, so
 * it fills itself in from now on. The chips are the usual items from earlier months, for one tap.
 */
export function QuickAdd({ plan, householdId }: QuickAddProps) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [monthly, setMonthly] = useState(false);
  const [billDay, setBillDay] = useState('');
  // A monthly bill set up here was saved with no payment method, so it counted as paid by hand
  // and went Overdue a few days after its date. Most regular bills are direct debits.
  const [method, setMethod] = useState<PaymentMethodOption>('direct_debit');
  const [pasteOpen, setPasteOpen] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const { mutate: createEntries, isPending: addingEntry } = useCreateEntries();
  const { mutate: createSubscription, isPending: addingBill } = useCreateSubscription();
  const busy = addingEntry || addingBill;
  const month = plan.period.label.split(' ')[0];

  const reset = () => {
    setLabel('');
    setAmount('');
    setMonthly(false);
    setBillDay('');
    setMethod('direct_debit');
  };

  const add = () => {
    const name = label.trim();
    const cents = toCents(amount);
    if (!name) {
      toast.error('What is it for?');
      return;
    }
    if (cents === null || cents < 0) {
      toast.error('Enter an amount');
      amountRef.current?.focus();
      return;
    }

    if (monthly) {
      const day = billDay.trim() ? Number(billDay) : defaultBillDay(plan);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        toast.error('Pick a day of the month from 1 to 31');
        return;
      }
      createSubscription(
        {
          name,
          amount,
          currency: plan.currency,
          billingFrequency: 'monthly',
          billingDay: day,
          startDate: firstBillDate(plan.period, day),
          kind: 'bill',
          paymentMethod: method,
          householdId,
        },
        {
          onSuccess: () => {
            toast.success(`${name} added as a monthly bill`);
            reset();
          },
          onError: (error) => toast.error(error.message),
        },
      );
      return;
    }

    createEntries(
      [{ date: defaultEntryDate(plan), label: name, amount, householdId: householdId ?? null }],
      {
        onSuccess: () => {
          toast.success(`${name} added to ${month}`);
          reset();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Card data-private className="py-0">
      <CardContent className="space-y-3 p-4">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          {/* flex-1 only side by side: in the phone's column it shrank the box to 30px. */}
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`Add to ${month}: e.g. Birthday present`}
            className="h-11 sm:flex-1"
            aria-label="What it's for"
            maxLength={120}
          />
          <div className="flex gap-2">
            <Input
              ref={amountRef}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              className="amount h-11 w-28 text-right"
              aria-label="Amount"
            />
            <Button type="submit" className="h-11 flex-1 sm:flex-none" disabled={busy}>
              <Plus className="mr-1 h-4 w-4" />Add
            </Button>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="quick-add-monthly" className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-normal">
            <Switch id="quick-add-monthly" checked={monthly} onCheckedChange={setMonthly} className={TAP_TARGET} />
            Every month
          </Label>
          <Button type="button" variant="ghost" className="h-11" onClick={() => setPasteOpen(true)}>
            <ClipboardPaste className="mr-1 h-4 w-4" />Paste a list
          </Button>
        </div>

        {monthly && (
          <div className="grid grid-cols-[6rem_1fr] gap-2">
            <div className="space-y-1">
              <Label htmlFor="quick-add-day" className="text-xs text-muted-foreground">Day of the month</Label>
              <Input
                id="quick-add-day"
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
              <Label htmlFor="quick-add-method" className="text-xs text-muted-foreground">Paid by</Label>
              <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethodOption)}>
                <SelectTrigger id="quick-add-method" className="h-11 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>{PAYMENT_METHOD_LABEL[option]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">
              {method === 'manual'
                ? 'You tick it off when you pay it; it shows as overdue if you don’t.'
                : 'Ticked off for you once it’s due. You can undo that if it didn’t go out.'}
            </p>
          </div>
        )}

        {plan.suggestions.length > 0 && (
          <div className="space-y-1.5">
            <p id="usual-items" className="text-xs font-medium text-muted-foreground">Your usual items</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="usual-items">
              {plan.suggestions.slice(0, 16).map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => {
                    setLabel(suggestion.label);
                    const cents = toCents(suggestion.amount);
                    setAmount(cents === null ? '' : fromCents(cents));
                    amountRef.current?.focus();
                  }}
                  className={cn('min-h-9 rounded-full border px-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground')}
                  title={toCents(suggestion.amount) === null ? undefined : `Last time ${formatCents(toCents(suggestion.amount)!, plan.currency)}`}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <PasteLinesDialog open={pasteOpen} onOpenChange={setPasteOpen} plan={plan} householdId={householdId} />
    </Card>
  );
}
