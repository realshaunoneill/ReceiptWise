import type { Metadata } from 'next';
import Link from 'next/link';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScanLine, BarChart3, Users, CheckCircle2, Wallet } from 'lucide-react';
import { SignInPanel } from '@/components/auth/sign-in-panel';
import { isDevLoginEnabled, isGoogleConfigured } from '@/lib/dev-login';
import { BILLS_LAUNCHED } from '@/lib/public-features';
import { pageMetadata } from '@/lib/seo';
import { safeNext } from '@/lib/sign-in-redirect';

export const metadata: Metadata = pageMetadata({
  title: 'Sign in - ReceiptWise',
  description: 'Sign in to ReceiptWise with your Google account.',
  path: '/sign-in',
  // robots.txt keeps crawlers off it too.
  index: false,
});

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // proxy.ts sends signed-out visitors here with ?redirect_url=<the page they wanted>.
  const params = await searchParams;
  const next = safeNext(params.redirect_url);
  // "Add another account" in the account menu: someone else signs in beside the current account.
  const adding = params.add === '1';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="" width={32} height={32} className="h-8 w-8" aria-hidden="true" />
            <span className="text-xl font-bold text-foreground">ReceiptWise</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center relative">
            {/* Left Side - Benefits */}
            <div className="space-y-8 order-2 lg:order-1">
              {/* Was preceded by an "✨ AI-powered expense tracking" pill, and the
                  three feature icons below sat in emerald, blue and orange tiles —
                  three colours for three items on a page with one accent. */}
              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                  Welcome to ReceiptWise
                </h1>
                <p className="mt-4 text-lg text-muted-foreground">
                  {BILLS_LAUNCHED
                    ? 'Know what’s left until payday: your pay, your bills and your receipts in one plan.'
                    : 'Your receipts and your household, in one place.'}
                </p>
              </div>

              <div className="space-y-5">
                <div className="flex gap-3">
                  <ScanLine className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <h2 className="font-semibold text-foreground">Receipts read for you</h2>
                    <p className="text-sm text-muted-foreground">
                      Merchant, amount, date and every line item, off the image.
                    </p>
                  </div>
                </div>

                {/* With bills launched, the plan takes this slot: it is what's new, and the
                    analytics are a line on the landing page. */}
                <div className="flex gap-3">
                  {BILLS_LAUNCHED
                    ? <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    : <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />}
                  <div>
                    <h2 className="font-semibold text-foreground">{BILLS_LAUNCHED ? 'Your month, planned' : 'Spending analytics'}</h2>
                    <p className="text-sm text-muted-foreground">
                      {BILLS_LAUNCHED
                        ? 'Your pay, your bills, and what is left for each week.'
                        : 'Category breakdowns and trends over the period you choose.'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <h2 className="font-semibold text-foreground">Household sharing</h2>
                    <p className="text-sm text-muted-foreground">
                      {BILLS_LAUNCHED
                        ? 'Plan the same month with your partner or the family.'
                        : 'One receipt pile for everyone who shares the bills.'}
                    </p>
                  </div>
                </div>
              </div>

              <Card className="border-primary/20 bg-primary/5">
                <CardContent>
                  <ul className="space-y-3">
                    {[
                      'Cancel any time from Settings',
                      'Unlimited receipt storage',
                      'Export everything whenever you want',
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                        <span className="text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Divider */}
            <Separator orientation="vertical" className="hidden lg:block h-auto absolute left-1/2 top-0 bottom-0 -translate-x-1/2" />

            {/* Right Side - Sign In Form */}
            <div className="order-1 lg:order-2">
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-8 sm:p-10">
                  {/* "Welcome back" was here as well as in the h1 to the left of
                      it — the same greeting twice on one screen. And an "✨ Quick &
                      Secure Sign In" panel explained how sign-in works directly
                      above the sign-in form, which explains itself. */}
                  <div className="mb-8">
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                      {adding ? 'Add another account' : 'Sign in'}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {adding
                        ? 'Sign in as someone else in your household. You stay signed in too, and can switch between you from the account menu.'
                        : 'With your Google account. New here? The same button creates your account.'}
                    </p>
                  </div>

                  <SignInPanel
                    next={next}
                    googleEnabled={isGoogleConfigured()}
                    devLogin={isDevLoginEnabled()}
                    prefillDevLogin={!process.env.VERCEL}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
