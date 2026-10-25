'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Chrome, Loader2, PlugZap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/lib/hooks/use-user';

/**
 * One-click connect for ReceiptWise Clipper. The extension opens this page with its own id
 * (?ext=…); the page checks the extension is there, asks /api/extension/connect for a key, and
 * hands it over with chrome.runtime.sendMessage. Only receiptwise.io pages can message the
 * extension (its externally_connectable), and the extension checks the sender's origin too.
 *
 * It checks the extension answers before asking for a key, so an unreachable extension doesn't
 * leave a key behind that nothing holds.
 */

type Runtime = {
  sendMessage: (extensionId: string, message: unknown, callback: (response: unknown) => void) => void;
  lastError?: { message?: string };
};

function extensionRuntime(): Runtime | null {
  const runtime = (window as unknown as { chrome?: { runtime?: Runtime } }).chrome?.runtime;
  return runtime && typeof runtime.sendMessage === 'function' ? runtime : null;
}

function messageExtension<T>(extensionId: string, message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const runtime = extensionRuntime();
    if (!runtime) {
      reject(new Error('unreachable'));
      return;
    }
    try {
      runtime.sendMessage(extensionId, message, (response) => {
        if (runtime.lastError) reject(new Error(runtime.lastError.message || 'unreachable'));
        else resolve(response as T);
      });
    } catch {
      reject(new Error('unreachable'));
    }
  });
}

type State =
  | { kind: 'checking' }
  | { kind: 'unreachable' }
  | { kind: 'ready'; version?: string }
  | { kind: 'connecting' }
  | { kind: 'connected' }
  | { kind: 'error'; message: string };

function ConnectExtension() {
  const extensionId = useSearchParams().get('ext') ?? '';
  const { user, isSubscribed, isLoading } = useUser();
  const [state, setState] = useState<State>({ kind: 'checking' });

  useEffect(() => {
    if (!/^[a-p]{32}$/.test(extensionId)) {
      setState({ kind: 'unreachable' });
      return;
    }
    messageExtension<{ ok?: boolean; version?: string }>(extensionId, { action: 'ping' })
      .then((response) => setState(response?.ok ? { kind: 'ready', version: response.version } : { kind: 'unreachable' }))
      .catch(() => setState({ kind: 'unreachable' }));
  }, [extensionId]);

  const connect = async () => {
    setState({ kind: 'connecting' });
    try {
      const response = await fetch('/api/extension/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extensionId }),
      });
      const body = await response.json().catch(() => ({})) as { key?: string; email?: string; subscribed?: boolean; error?: string };
      if (!response.ok || !body.key) throw new Error(body.error || "Couldn't connect the extension. Try again.");
      const handed = await messageExtension<{ ok?: boolean; error?: string }>(extensionId, {
        action: 'connect',
        apiKey: body.key,
        email: body.email,
        subscribed: body.subscribed,
      });
      if (!handed?.ok) throw new Error(handed?.error || "The extension didn't accept the connection. Try again.");
      setState({ kind: 'connected' });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : "Couldn't connect the extension." });
    }
  };

  return (
    <main className="container mx-auto flex max-w-xl flex-col gap-6 p-4 py-12 sm:p-6 sm:py-16" aria-labelledby="connect-title">
      <Card>
        <CardHeader>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
            <PlugZap className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <CardTitle id="connect-title" className="text-2xl">Connect ReceiptWise Clipper</CardTitle>
          <CardDescription className="text-base">
            {user?.email
              ? <>The Chrome extension will add receipts to <span className="font-medium text-foreground">{user.email}</span>. It gets its own key, which you can revoke any time in Settings → Integrations.</>
              : 'The Chrome extension will add receipts to your account, with its own key that you can revoke any time in Settings.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading || state.kind === 'checking' ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Looking for the extension…
            </p>
          ) : !isSubscribed ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">The extension is part of Premium.</p>
              <Button asChild><Link href="/upgrade">See Premium</Link></Button>
            </div>
          ) : state.kind === 'unreachable' ? (
            <div className="flex items-start gap-3 rounded-lg border p-4 text-sm">
              <Chrome className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-muted-foreground">
                The extension isn&apos;t answering in this browser. Open this page from the
                extension&apos;s <span className="font-medium text-foreground">Connect</span> button, in Chrome
                with ReceiptWise Clipper installed and switched on.
              </p>
            </div>
          ) : state.kind === 'connected' ? (
            <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-4 text-sm">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              <p>
                Connected. You can close this tab. To clip a receipt, click the ReceiptWise icon in the
                toolbar, or press <kbd className="rounded border px-1">⌃⇧R</kbd> on a Mac
                (<kbd className="rounded border px-1">Alt+Shift+R</kbd> elsewhere).
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Button onClick={connect} disabled={state.kind === 'connecting'} className="gap-2">
                {state.kind === 'connecting' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {state.kind === 'connecting' ? 'Connecting…' : 'Connect'}
              </Button>
              {state.kind === 'error' && <p className="text-sm text-destructive" role="alert">{state.message}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export default function ConnectExtensionPage() {
  // useSearchParams needs a Suspense boundary in a statically rendered page.
  return (
    <Suspense fallback={null}>
      <ConnectExtension />
    </Suspense>
  );
}
