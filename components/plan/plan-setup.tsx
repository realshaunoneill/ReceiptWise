'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { localToday } from '@/lib/dates/local-date';
import { invalidateFinanceQueries } from '@/lib/hooks/use-plan';
import { type PlanResponse } from '@/lib/services/plan-service';
import { cn } from '@/lib/utils';
import { formatCents } from '@/lib/utils/currency';
import { planBreakdown } from '@/shared/plan/breakdown';
import { BILL_PICKS, billRequests, incomeRequest, payProblem, type BillAnswer, type PayAnswer } from '@/shared/plan/setup';

const FREQUENCIES: Array<{ value: PayAnswer['frequency']; label: string }> = [
  { value: 'monthly', label: 'Monthly, on a set day' },
  { value: 'last_working_day', label: 'Monthly, last working day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'fortnightly', label: 'Every two weeks' },
  { value: 'four_weekly', label: 'Every four weeks' },
];

async function send<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init && { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
  const body = await res.json().catch(() => null) as { error?: unknown } | null;
  if (!res.ok) throw new Error(typeof body?.error === 'string' ? body.error : "Couldn't save that");
  return body as T;
}

type Props = {
  currency: string;
  householdId?: string;
  /** After "See my plan". */
  onDone: () => void;
  /** "Skip for now": the plan's "Start with your pay" stays for later. */
  onSkip: () => void;
};

/**
 * The guided plan setup (shared/plan/setup.ts, as the app's src/plan/PlanSetup.tsx): your pay,
 * your main bills picked from a list, then what's left after them. The first run and the plan's
 * "Start with your pay" both show it; it teaches more than a tour of slides would.
 */
export function PlanSetup({ currency, householdId, onDone, onSkip }: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'pay' | 'bills' | 'done'>('pay');
  const [pay, setPay] = useState<PayAnswer>({ amount: '', frequency: 'monthly', payDay: 25, anchorDate: localToday() });
  const [bills, setBills] = useState<Record<string, BillAnswer>>({});
  const [extra, setExtra] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResponse | null>(null);

  const planNow = () => {
    const params = new URLSearchParams({ offset: '0', today: localToday() });
    if (householdId) params.set('householdId', householdId);
    return send<PlanResponse>(`/api/plan?${params}`);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await send('/api/income', { method: 'POST', body: JSON.stringify(incomeRequest(pay, currency, householdId ?? null)) });
      // The period comes from the pay just added, so the bills land in this month's plan.
      const plan = await planNow();
      for (const body of billRequests(Object.values(bills), plan.period, currency, householdId ?? null)) {
        await send('/api/subscriptions', { method: 'POST', body: JSON.stringify(body) });
      }
      await invalidateFinanceQueries(queryClient);
      setResult(await planNow());
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that");
    } finally {
      setSaving(false);
    }
  };

  if (step === 'done' && result) {
    const breakdown = planBreakdown(result.lines);
    const money = (cents: number) => formatCents(Math.abs(cents), result.currency);
    return (
      <div className="space-y-5" data-private>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Your plan is ready</h2>
        <div>
          <p className="text-sm text-muted-foreground">After bills this month</p>
          <p className={cn('amount text-4xl font-semibold tracking-tight', breakdown.afterBillsCents < 0 && 'text-destructive')}>{money(breakdown.afterBillsCents)}</p>
          <p className="amount text-sm text-muted-foreground">
            {money(breakdown.leftCents)} left once everything&apos;s out · {formatCents(result.totals.weeklyCents, result.currency)} a week
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Add savings and one-offs on the plan. A bill different this month? Click its amount.</p>
        <Button onClick={onDone}>See my plan</Button>
      </div>
    );
  }

  if (step === 'bills') {
    const picks = [...BILL_PICKS.map((pick) => ({ key: pick.key, label: pick.label })), ...Object.values(bills).filter((bill) => bill.key.startsWith('own:'))];
    const toggle = (key: string, label: string) => setBills((current) => {
      const next = { ...current };
      if (next[key]) delete next[key];
      else next[key] = { key, label, amount: '' };
      return next;
    });
    return (
      <div className="space-y-5" data-private>
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Your main bills</h2>
          <p className="text-muted-foreground">Tick the ones you pay and put in roughly how much. You can change any of them later.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {picks.map((pick) => {
            const chosen = bills[pick.key];
            return (
              <div key={pick.key} className={cn('space-y-2 rounded-lg border p-3', chosen && 'border-primary bg-primary/5')}>
                <button type="button" onClick={() => toggle(pick.key, pick.label)} className="flex min-h-9 w-full items-center gap-2 text-left text-sm" aria-pressed={!!chosen}>
                  <span className={cn('flex size-5 items-center justify-center rounded-full border-2', chosen ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground')}>
                    {chosen && <Check className="size-3" />}
                  </span>
                  <span className={cn(chosen && 'font-medium')}>{pick.label}</span>
                </button>
                {chosen && (
                  <Input
                    autoFocus
                    value={chosen.amount}
                    onChange={(e) => setBills((current) => ({ ...current, [pick.key]: { ...chosen, amount: e.target.value } }))}
                    placeholder="Roughly how much"
                    inputMode="decimal"
                    className="amount h-10"
                    aria-label={`${pick.label}, roughly`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!extra.trim()) return;
            const key = `own:${extra.trim().toLowerCase()}`;
            setBills((current) => ({ ...current, [key]: { key, label: extra.trim(), amount: '' } }));
            setExtra('');
          }}
        >
          <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Something else: bin collection" maxLength={100} aria-label="Another bill" />
          <Button type="submit" variant="outline" disabled={!extra.trim()}><Plus className="mr-1 h-4 w-4" />Add</Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {Object.keys(bills).length ? 'Save my plan' : 'Save, with no bills yet'}
          </Button>
          <Button variant="ghost" onClick={() => setStep('pay')}>Back</Button>
        </div>
      </div>
    );
  }

  const weekly = ['weekly', 'fortnightly', 'four_weekly'].includes(pay.frequency);
  return (
    <div className="space-y-5" data-private>
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Your pay</h2>
        <p className="text-muted-foreground">The plan runs from one payday to the next, so it starts with what comes in and when.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="setup-pay">What you get paid, after tax</Label>
          <Input id="setup-pay" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} inputMode="decimal" placeholder="0.00" className="amount" autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="setup-frequency">How often</Label>
          <Select value={pay.frequency} onValueChange={(frequency) => setPay({ ...pay, frequency: frequency as PayAnswer['frequency'] })}>
            <SelectTrigger id="setup-frequency"><SelectValue /></SelectTrigger>
            <SelectContent>{FREQUENCIES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {pay.frequency === 'monthly' && (
          <div className="space-y-1.5">
            <Label htmlFor="setup-day">Payday</Label>
            <Input id="setup-day" type="number" min={1} max={31} inputMode="numeric" value={pay.payDay ?? ''} onChange={(e) => setPay({ ...pay, payDay: Number(e.target.value) || null })} />
            <p className="text-xs text-muted-foreground">The day of the month. A weekend or bank holiday moves it to the working day before.</p>
          </div>
        )}
        {weekly && (
          <div className="space-y-1.5">
            <Label htmlFor="setup-anchor">A day you were paid</Label>
            <Input id="setup-anchor" type="date" value={pay.anchorDate ?? ''} onChange={(e) => setPay({ ...pay, anchorDate: e.target.value || null })} />
          </div>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            const problem = payProblem(pay);
            setError(problem);
            if (!problem) setStep('bills');
          }}
        >
          Continue
        </Button>
        <Button variant="ghost" onClick={onSkip}>Skip for now</Button>
      </div>
    </div>
  );
}
