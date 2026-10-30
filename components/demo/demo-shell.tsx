'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArrowRight, Receipt, Repeat, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { AppBaseProvider } from '@/lib/app-base';
import { authClient } from '@/lib/auth-client';
import { installDemoFetch } from '@/lib/demo/fetch-shim';
import { demoMonthShift } from '@/lib/demo/shift';
import { useAttributionQuery } from '@/lib/hooks/use-attribution';
import fixture from '@/lib/demo/fixture.json';

/*
 * The demo's fetch goes in when this module first runs in the browser, before the demo's pages
 * render or ask for data, and comes out when the demo closes. Every way out of the demo is a full
 * page load, so none of the demo's session or data is left behind in the real site.
 *
 * The site's layout can ask Better Auth for the session before this module has loaded (the
 * segments hydrate separately), and that answer is "nobody". So the session is asked for again
 * (lib/auth-client.ts looks fetch up per request, so the demo's answers it), and again if the
 * real answer lands after the demo's, up to three times.
 */
let uninstall: (() => void) | null = null;
if (typeof window !== 'undefined' && !uninstall) {
  uninstall = installDemoFetch(fixture.responses, demoMonthShift(fixture.capturedOn, new Date()));
  authClient.$store.notify('$sessionSignal');
}

function useDemoSession() {
  useEffect(() => {
    let tries = 0;
    const unsubscribe = authClient.$store.atoms.session.subscribe((state: { data: unknown; isPending: boolean }) => {
      if (!state.isPending && !state.data && tries < 3) {
        tries++;
        authClient.$store.notify('$sessionSignal');
      }
    });
    return unsubscribe;
  }, []);
}

const TABS = [
  { href: '/demo/plan', label: 'Plan', icon: Wallet },
  { href: '/demo/subscriptions', label: 'Bills', icon: Repeat },
  { href: '/demo/receipts', label: 'Receipts', icon: Receipt },
];

/**
 * The demo household's month, in the app's own pages (app/demo): the Byrnes' plan, bills and
 * receipts, recorded from the staging household as persona data (lib/demo/fixture.json). Nothing
 * reaches the server and nothing is saved.
 */
export function DemoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const attribution = useAttributionQuery();
  useDemoSession();
  // Its own cache, separate from the site's, with nothing to refetch.
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } },
  }));
  useEffect(() => () => {
    uninstall?.();
    uninstall = null;
  }, []);
  const signUp = `/sign-up${attribution || '?src=demo'}`;

  return (
    <QueryClientProvider client={queryClient}>
      <AppBaseProvider value="/demo">
        <div className="min-h-screen bg-background">
          <div className="border-b bg-primary text-primary-foreground">
            <div className="container mx-auto flex flex-col gap-2 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p>
                <strong>A demo month</strong> for the Byrnes, a made-up household. Look around: nothing you change here is saved.
              </p>
              <a href={signUp} className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline">
                Start the free trial <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
          <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
            <div className="container mx-auto flex h-14 items-center justify-between gap-2 px-4">
              {/* Full page loads out of the demo: see the module comment. */}
              <a href="/" className="flex items-center gap-2" aria-label="ReceiptWise home">
                <img src="/logo-mark.png" alt="" width={28} height={28} className="h-7 w-7" aria-hidden="true" />
                <span className="hidden font-semibold tracking-tight sm:inline">ReceiptWise</span>
              </a>
              <nav className="flex items-center gap-1" aria-label="Demo">
                {TABS.map(({ href, label, icon: Icon }) => (
                  <Button key={href} asChild size="sm" variant={pathname === href ? 'default' : 'ghost'} className="gap-1.5">
                    <a href={href} aria-current={pathname === href ? 'page' : undefined}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {label}
                    </a>
                  </Button>
                ))}
              </nav>
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <Button asChild size="sm" className="hidden sm:inline-flex">
                  <a href={signUp}>Try it free</a>
                </Button>
              </div>
            </div>
          </header>
          {children}
        </div>
      </AppBaseProvider>
    </QueryClientProvider>
  );
}
