'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signInWithGoogle, signInWithPassword, signUpWithPassword } from '@/lib/auth-client';
import { NEW_USER_URL } from '@/lib/sign-in-redirect';


function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

/**
 * Local development only (lib/dev-login.ts): a real Better Auth session without Google, for manual
 * and automated testing. Signs in, or creates the account on first use.
 */
function DevSignIn({ next }: { next: string }) {
  const [email, setEmail] = useState('dev@receiptwise.local');
  const [password, setPassword] = useState('receiptwise-dev-password');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-6 space-y-3 rounded-lg border border-dashed p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        // better-auth returns errors rather than throwing.
        const signedIn = await signInWithPassword(email, password, next);
        const error = signedIn.error
          ? (await signUpWithPassword(email, password, email.split('@')[0], NEW_USER_URL)).error
          : null;
        if (error) {
          setError(error.message ?? 'Sign-in failed');
          setBusy(false);
          return;
        }
        window.location.assign(next);
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dev sign-in</p>
      <div className="space-y-1.5">
        <Label htmlFor="dev-email">Email</Label>
        <Input id="dev-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dev-password">Password</Label>
        <Input id="dev-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>
      <Button type="submit" variant="secondary" className="w-full" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in with password'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">Local only: RECEIPTWISE_DEV_LOGIN=1, never on Vercel.</p>
    </form>
  );
}

/**
 * Sign-in for ReceiptWise: Google only. The same button signs in and creates an account, so the
 * sign-in and sign-up pages both use this.
 *
 * `next` comes from the server page (already checked to be a path on this site), rather than
 * useSearchParams, so the button is in the server HTML and works before hydration.
 */
export function SignInPanel({
  next,
  googleEnabled,
  devLogin,
  label = 'Continue with Google',
}: {
  next: string;
  googleEnabled: boolean;
  devLogin: boolean;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full gap-2 text-sm font-medium"
        disabled={busy || !googleEnabled}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await signInWithGoogle(next, NEW_USER_URL).catch((err: unknown) => ({
            error: { message: err instanceof Error ? err.message : undefined },
          }));
          // On success the browser is already on its way to Google.
          if (result?.error) {
            setError(result.error.message || "Couldn't reach Google. Try again.");
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <GoogleIcon />}
        {busy ? 'Opening Google…' : label}
      </Button>

      {!googleEnabled && (
        <p className="mt-2 text-sm text-muted-foreground">Google sign-in isn&apos;t configured on this deployment.</p>
      )}
      {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
      {devLogin && <DevSignIn next={next} />}
    </>
  );
}
