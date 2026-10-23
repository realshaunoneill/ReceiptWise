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
import { Textarea } from '@/components/ui/textarea';
import { useCreateSubscription } from '@/hooks/use-subscriptions';
import { toUtcDate } from '@/lib/dates/local-date';
import { useCreateEntries } from '@/lib/hooks/use-plan';
import { toCents } from '@/lib/money';
import { parseLines } from '@/lib/plan/parse-lines';
import { type PlanResponse } from '@/lib/services/plan-service';
import { formatCurrency } from '@/lib/utils/currency';
import { defaultEntryDate } from './quick-add';

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
 */
export function PasteLinesDialog({ open, onOpenChange, plan, householdId }: PasteLinesDialogProps) {
  const [text, setText] = useState('');
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [monthly, setMonthly] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const { mutateAsync: createEntries } = useCreateEntries();
  const { mutateAsync: createSubscription } = useCreateSubscription();

  const parsed = useMemo(() => parseLines(text), [text]);
  const withAmount = parsed
    .map((line, index) => ({ ...line, index, cents: line.amount === null ? null : toCents(line.amount) }))
    .filter((line) => line.cents !== null && line.cents > 0);
  const chosen = withAmount.filter((line) => !excluded.has(line.index));
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
    setExcluded(new Set());
    setMonthly(new Set());
  };

  const save = async () => {
    if (chosen.length === 0) return;
    setSaving(true);
    const date = defaultEntryDate(plan);
    try {
      const oneOffs = chosen.filter((line) => !monthly.has(line.index));
      const bills = chosen.filter((line) => monthly.has(line.index));
      if (oneOffs.length > 0) {
        await createEntries(oneOffs.map((line) => ({ date, label: line.label, amount: line.amount!, householdId: householdId ?? null })));
      }
      for (const line of bills) {
        await createSubscription({
          name: line.label,
          amount: line.amount!,
          currency: plan.currency,
          billingFrequency: 'monthly',
          billingDay: toUtcDate(plan.period.start).getUTCDate(),
          startDate: plan.period.start,
          kind: 'bill',
          householdId,
        });
      }
      toast.success(`Added ${chosen.length} to ${month}${bills.length > 0 ? `, ${bills.length} as monthly bills` : ''}`);
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
            setExcluded(new Set());
            setMonthly(new Set());
          }}
          placeholder={'Rent 150\nCar 469\nNiamhs wedding 400'}
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
                <li key={line.index} className="flex items-center gap-3 px-3 py-2">
                  <Checkbox
                    checked={!excluded.has(line.index)}
                    onCheckedChange={() => toggle(excluded, line.index, setExcluded)}
                    aria-label={`Add ${line.label}`}
                  />
                  <span className="min-w-0 flex-1 truncate">{line.label}</span>
                  <span className="amount tabular-nums">{formatCurrency(line.cents! / 100, plan.currency)}</span>
                  <Checkbox
                    checked={monthly.has(line.index)}
                    disabled={excluded.has(line.index)}
                    onCheckedChange={() => toggle(monthly, line.index, setMonthly)}
                    aria-label={`${line.label} every month`}
                  />
                </li>
              ))}
            </ul>
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
