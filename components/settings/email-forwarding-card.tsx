'use client';

import { useState } from 'react';
import { CheckCircle2, Copy, Mail, RefreshCw } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFeature } from '@/lib/hooks/use-user';

type InboundAddress = { address: string; createdAt: string; rotatedAt: string | null };
type InboundEmail = {
  id: string;
  fromAddress: string | null;
  subject: string | null;
  status: string;
  error: string | null;
  partCount: number | null;
  confirmationCode: string | null;
  confirmationUrl: string | null;
  receivedAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  receiving: 'Arriving',
  stored: 'Reading',
  processed: 'Read',
  no_content: 'Nothing to read',
  rejected_limit: 'Over the daily limit',
  forwarding_confirmation: 'Forwarding confirmation',
  failed: 'Failed',
};

/**
 * When an email arrived, in the viewer's own time zone. It used to take the UTC day, so a bill
 * forwarded late in the evening west of UTC (or just after midnight in Irish summer time) showed
 * the wrong day.
 */
function formatReceived(receivedAt: string): string {
  const received = new Date(receivedAt);
  const sameDay = received.toDateString() === new Date().toDateString();
  return sameDay
    ? received.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
    : received.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}

/** The address with a break opportunity before the @, so a narrow screen wraps there and the domain stays visible. */
function WrappingAddress({ address }: { address: string }) {
  const at = address.lastIndexOf('@');
  if (at <= 0) return <>{address}</>;
  return <>{address.slice(0, at)}<wbr />{address.slice(at)}</>;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? 'Something went wrong');
  }
  return res.json() as Promise<T>;
}

/**
 * The user's forwarding address: forward bills and receipts to it (or set a rule in Gmail or
 * Outlook) and they arrive in the plan. Gmail sends a confirmation email to the address before a
 * forwarding rule starts; its code shows up here.
 */
export function EmailForwardingCard() {
  const enabled = useFeature('bills');
  const queryClient = useQueryClient();
  const [confirmRotate, setConfirmRotate] = useState(false);
  const { data: address } = useQuery<InboundAddress>({
    queryKey: ['inbound-address'],
    queryFn: () => fetchJson('/api/inbound-address'),
    enabled,
  });
  const { data: emails = [] } = useQuery<InboundEmail[]>({
    queryKey: ['inbound-emails'],
    queryFn: () => fetchJson('/api/inbound-emails'),
    enabled,
    refetchInterval: 15_000,
  });
  const rotate = useMutation({
    mutationFn: () => fetchJson<InboundAddress>('/api/inbound-address/rotate', { method: 'POST' }),
    onSuccess: (next) => {
      queryClient.setQueryData(['inbound-address'], next);
      setConfirmRotate(false);
      toast.success('New address made. Update any forwarding rules to use it.');
    },
    onError: (error) => toast.error(error.message),
  });

  if (!enabled) return null;
  const confirmation = emails.find((email) => email.status === 'forwarding_confirmation');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Forward bills by email</CardTitle>
        <CardDescription>
          Forward a bill or receipt to this address, or set up a rule in your email to forward them
          automatically. Attachments are read and land in your plan, or in Receipts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Was a read-only input, which cut the address off on a phone, domain and all. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center" data-private>
          <p className="min-h-10 flex-1 select-all rounded-md border bg-muted/30 px-3 py-2 font-mono text-sm wrap-anywhere">
            <span className="sr-only">Your forwarding address: </span>
            {address ? <WrappingAddress address={address.address} /> : 'Loading…'}
          </p>
          <Button
            variant="outline"
            className="self-start sm:self-auto"
            onClick={() => address && navigator.clipboard.writeText(address.address).then(() => toast.success('Copied'))}
            disabled={!address}
          >
            <Copy className="mr-1.5 h-4 w-4" />Copy
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Anyone with this address can send to your account, so keep it to forwarding rules. If it gets out, make a new one.
        </p>

        {confirmation && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm" data-private>
            <p className="font-medium">Gmail wants you to confirm forwarding</p>
            {confirmation.confirmationCode && <p>Code: <span className="font-mono font-semibold">{confirmation.confirmationCode}</span></p>}
            {confirmation.confirmationUrl && (
              <a className="text-primary underline" href={confirmation.confirmationUrl} target="_blank" rel="noopener noreferrer">Confirm in Gmail</a>
            )}
          </div>
        )}

        <div className="space-y-1.5" data-private>
          <p className="text-sm font-medium">Recent</p>
          {emails.length > 0 ? (
            <ul className="divide-y rounded-lg border text-sm">
              {emails.slice(0, 8).map((email) => (
                <li key={email.id} className="flex items-center gap-3 px-3 py-2">
                  {email.status === 'processed' && <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />}
                  <span className="min-w-0 flex-1 truncate">{email.subject || email.fromAddress || 'Email'}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatReceived(email.receivedAt)}</span>
                  <Badge variant={email.status === 'failed' ? 'destructive' : 'outline'}>{STATUS_LABEL[email.status] ?? email.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
              Nothing forwarded yet. Emails sent to this address show up here as they arrive.
            </p>
          )}
        </div>

        <div>
          {confirmRotate ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Mail to the current address will stop being accepted.</span>
              <Button size="sm" variant="destructive" onClick={() => rotate.mutate()} disabled={rotate.isPending}>Make a new address</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmRotate(false)}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmRotate(true)}>
              <RefreshCw className="mr-1.5 h-4 w-4" />Make a new address
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
