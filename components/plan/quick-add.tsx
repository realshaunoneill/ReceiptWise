'use client';

import { useRef, useState } from 'react';
import { ClipboardPaste, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCreateSubscription } from '@/hooks/use-subscriptions';
import { localToday, toUtcDate } from '@/lib/dates/local-date';
import { useCreateEntries } from '@/lib/hooks/use-plan';
import { toCents } from '@/lib/money';
import { type PlanResponse } from '@/lib/services/plan-service';
import { PasteLinesDialog } from './paste-lines-dialog';

/** The day new lines are dated: today if it's in the period being viewed, else its first day. */
export function defaultEntryDate(plan: PlanResponse): string {
  const today = localToday();
  return today >= plan.period.start && today < plan.period.end ? today : plan.period.start;
}

type QuickAddProps = {
  plan: PlanResponse;
  householdId?: string;
};

/**
 * Add a line to the period the way you'd type it into the sheet: a label and an amount. "Every
 * month" makes it a recurring bill instead, so it fills itself in from now on. The chips are the
 * usual items from earlier months, for one tap.
 */
export function QuickAdd({ plan, householdId }: QuickAddProps) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [monthly, setMonthly] = useState(false);
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
    const date = defaultEntryDate(plan);

    if (monthly) {
      createSubscription(
        {
          name,
          amount,
          currency: plan.currency,
          billingFrequency: 'monthly',
          billingDay: toUtcDate(date).getUTCDate(),
          startDate: date,
          kind: 'bill',
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
      [{ date, label: name, amount, householdId: householdId ?? null }],
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
    <Card data-private>
      <CardContent className="space-y-3 p-4">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`Add to ${month}: e.g. Niamh's wedding`}
            className="h-11 flex-1"
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
          <div className="flex items-center gap-2">
            <Switch id="quick-add-monthly" checked={monthly} onCheckedChange={setMonthly} />
            <Label htmlFor="quick-add-monthly" className="text-sm font-normal">Every month</Label>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPasteOpen(true)}>
            <ClipboardPaste className="mr-1 h-4 w-4" />Paste a list
          </Button>
        </div>

        {plan.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Your usual items">
            {plan.suggestions.slice(0, 16).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setLabel(suggestion);
                  amountRef.current?.focus();
                }}
                className="min-h-8 rounded-full border px-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </CardContent>

      <PasteLinesDialog open={pasteOpen} onOpenChange={setPasteOpen} plan={plan} householdId={householdId} />
    </Card>
  );
}
