'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { type CancelMode, type CancelOptions, type CancelOutcome } from '@/lib/billing/withdrawal';

type Status = { source: string | null; options: CancelOptions; emailConfigured: boolean };
type Done = { outcome: CancelOutcome; text: string; emailed: boolean };

class SignedOut extends Error {}

const KEY = ['billing-cancel'];

const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en-IE', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso)) : null;
const money = (minor: number, currency: string) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: currency.toUpperCase() }).format(minor / 100);

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  if (res.status === 401) throw new SignedOut();
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: unknown } | null;
    throw new Error(typeof body?.error === 'string' ? body.error : fallback);
  }
  return res.json() as Promise<T>;
}

/**
 * Step one says what cancelling does today and offers the choices; step two confirms ("Confirm
 * withdrawal here", the directive's wording); then the confirmation, to keep. Everything is
 * decided again by the server when confirmed.
 */
export function CancelPanel() {
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState<CancelMode | null>(null);
  const status = useQuery({
    queryKey: KEY,
    queryFn: async () => readJson<Status>(await fetch('/api/billing/cancel'), 'We could not load your subscription.'),
    retry: (count, error) => !(error instanceof SignedOut) && count < 2,
  });
  const cancel = useMutation({
    mutationFn: async (mode: CancelMode) => readJson<Done>(
      await fetch('/api/billing/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) }),
      'We could not cancel just now. Please try again.',
    ),
    onSuccess: () => {
      // Settings and every Premium gate read the user; let them catch up.
      void queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  if (cancel.data) return <Confirmation done={cancel.data} />;

  if (status.isPending) return <Skeleton className="h-48 w-full" />;
  if (status.error instanceof SignedOut) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sign in first</CardTitle>
          <CardDescription>Sign in to the account that has Premium, and you come straight back here.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild><a href="/sign-in?redirect_url=/cancel">Sign in to cancel or withdraw</a></Button>
        </CardContent>
      </Card>
    );
  }
  if (status.isError) return <p className="text-sm text-destructive">{status.error.message}</p>;

  const { options, source } = status.data;

  if (options.kind === 'none') {
    const message =
      source === 'app_store' ? 'Your Premium is billed by the App Store. Cancel it on your iPhone: Settings › your name › Subscriptions.'
      : source === 'play_store' ? 'Your Premium is billed by Google Play. Cancel it in Google Play: Payments & subscriptions › Subscriptions.'
      : source === 'household' ? 'Your Premium comes from someone in your household, so there is nothing for you to cancel or pay.'
      : source === 'comp' ? 'Your Premium was given to you free, so there is nothing to cancel or pay.'
      : 'You have no Premium subscription on the website, so there is nothing to cancel.';
    return (
      <Card>
        <CardHeader><CardTitle>Nothing to cancel here</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{message}</p>
          <Link href="/settings?tab=subscription" className="text-primary hover:underline">Back to Settings</Link>
        </CardContent>
      </Card>
    );
  }

  const periodEnd = options.kind === 'trial' ? null : day(options.periodEndsAt);
  const alreadyEnding = options.kind !== 'trial' && options.cancelAtPeriodEnd;

  if (chosen) {
    const withdraw = chosen === 'withdraw';
    return (
      <Card>
        <CardHeader>
          <CardTitle>{withdraw ? 'Confirm your withdrawal' : 'Confirm your cancellation'}</CardTitle>
          <CardDescription>Nothing has changed yet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ul className="list-disc space-y-1 pl-5">
            {withdraw ? (
              <>
                <li>Premium stops now, and you will not be charged again.</li>
                {options.kind === 'refundable' && (
                  <li>We refund {money(options.charge.amount, options.charge.currency)}, the payment of {day(options.charge.chargedAt)}, to the card you paid with.</li>
                )}
                {options.kind === 'trial' && <li>You are in your free trial, so nothing has been charged.</li>}
              </>
            ) : (
              <li>Premium stays on until {periodEnd ?? 'the end of the period you paid for'}, then stops. You will not be charged again.</li>
            )}
            <li>Your receipts, bills and plan stay in your account.</li>
          </ul>
          {cancel.isError && <p className="text-destructive">{cancel.error.message}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" onClick={() => cancel.mutate(chosen)} disabled={cancel.isPending}>
              {cancel.isPending ? 'Working…' : withdraw ? 'Confirm withdrawal here' : 'Confirm cancellation'}
            </Button>
            <Button variant="outline" onClick={() => { setChosen(null); cancel.reset(); }} disabled={cancel.isPending}>Go back</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Premium</CardTitle>
        <CardDescription>
          {options.kind === 'trial'
            ? `You are in your free trial${options.trialEndsAt ? `, until ${day(options.trialEndsAt)}` : ''}.`
            : alreadyEnding
              ? `Already cancelled: Premium ends on ${periodEnd ?? 'the last day you paid for'}.`
              : `Paid on the website${periodEnd ? `, renews on ${periodEnd}` : ''}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {options.kind === 'trial' && (
          <Choice
            title="Stop the trial now"
            action="Withdraw from contract here"
            detail="Premium stops now, and you are never charged."
            onClick={() => setChosen('withdraw')}
          />
        )}
        {options.kind === 'refundable' && (
          <Choice
            title="Stop now, with a refund"
            action="Withdraw from contract here"
            detail={`Premium stops now and we refund ${money(options.charge.amount, options.charge.currency)}, your payment of ${day(options.charge.chargedAt)}. You can do this until ${day(options.charge.withdrawUntil)}.`}
            onClick={() => setChosen('withdraw')}
          />
        )}
        {options.kind !== 'trial' && !alreadyEnding && (
          <Choice
            title="Stop when the paid period ends"
            action="Cancel at the end of the period"
            detail={`Premium stays on until ${periodEnd ?? 'the end of the period you paid for'}, then stops.`}
            onClick={() => setChosen('period_end')}
            secondary={options.kind === 'refundable'}
          />
        )}
        {options.kind === 'period_end' && alreadyEnding && (
          <p>There is nothing more to do. The 14 days to withdraw for a refund have passed for your last payment.</p>
        )}
        <p className="text-muted-foreground">
          Changing card or plan instead? <Link href="/settings?tab=subscription" className="text-primary hover:underline">Settings → Premium</Link> has Manage billing.
        </p>
      </CardContent>
    </Card>
  );
}

function Choice({ title, action, detail, onClick, secondary = false }: { title: string; action: string; detail: string; onClick: () => void; secondary?: boolean }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-muted-foreground">{detail}</p>
      </div>
      <Button variant={secondary ? 'outline' : 'default'} onClick={onClick} className="shrink-0">{action}</Button>
    </div>
  );
}

function Confirmation({ done }: { done: Done }) {
  const save = () => {
    const url = URL.createObjectURL(new Blob([done.text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `receiptwise-${done.outcome.mode === 'withdraw' ? 'withdrawal' : 'cancellation'}-${done.outcome.receivedAt.slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{done.outcome.mode === 'withdraw' ? 'Withdrawal received' : 'Cancellation received'}</CardTitle>
        <CardDescription>
          {done.emailed ? `We have emailed this confirmation to ${done.outcome.email}.` : 'Keep a copy of this confirmation for your records.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 font-sans">{done.text}</pre>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={save}>Save a copy</Button>
          <Button variant="outline" asChild><Link href="/settings?tab=subscription">Back to Settings</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}
