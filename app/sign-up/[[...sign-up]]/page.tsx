import type { Metadata } from 'next';
import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScanLine, BarChart3, Users, CheckCircle2 } from 'lucide-react';
import { clerkAppearance } from '@/lib/clerk/appearance';

/*
 * This route did not exist. Every "Start the free trial" CTA on the landing
 * page, the exit-intent popup and Clerk's own signUpUrl pointed at /sign-up,
 * which fell through to not-found — so nobody could create an account from the
 * site. Mirrors the sign-in page so the two read as one flow.
 *
 * Trial length is derived the same way createCheckoutSession derives it, so
 * this page never promises a trial that checkout would not grant.
 */
const TRIAL_DAYS = process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS
  ? parseInt(process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS, 10)
  : 0;
const HAS_TRIAL = TRIAL_DAYS > 0 && !Number.isNaN(TRIAL_DAYS);

export const metadata: Metadata = {
  title: 'Create an account - ReceiptWise',
  alternates: {
    canonical: '/sign-up',
  },
};

export default function SignUpPage() {
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
              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                  One receipt pile for the whole household
                </h1>
                <p className="mt-4 text-lg text-muted-foreground">
                  Photograph a receipt, and ReceiptWise reads it for you and files it where
                  everyone who shares the bills can see it.
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

                <div className="flex gap-3">
                  <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <h2 className="font-semibold text-foreground">Spending analytics</h2>
                    <p className="text-sm text-muted-foreground">
                      Category breakdowns and trends over the period you choose.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <h2 className="font-semibold text-foreground">Household sharing</h2>
                    <p className="text-sm text-muted-foreground">
                      Invite a partner or housemate and see the same receipts.
                    </p>
                  </div>
                </div>
              </div>

              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-6">
                  <ul className="space-y-3">
                    {[
                      HAS_TRIAL
                        ? `${TRIAL_DAYS} days free, cancel any time before it ends`
                        : 'Cancel any time',
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

            {/* Right Side - Sign Up Form */}
            <div className="order-1 lg:order-2">
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="p-8 sm:p-10">
                  <div className="mb-8">
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                      Create your account
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {HAS_TRIAL
                        ? `Next you'll start the ${TRIAL_DAYS}-day trial. Card details are needed to begin; cancel during the trial and nothing is charged.`
                        : 'It takes under a minute.'}
                    </p>
                  </div>

                  <div className="flex justify-center">
                    <SignUp
                      appearance={clerkAppearance}
                      routing="path"
                      path="/sign-up"
                      signInUrl="/sign-in"
                      forceRedirectUrl="/redirect"
                    />
                  </div>

                  {/* Clerk's own footer link is hidden via the shared appearance, so
                      this is the only route back to sign-in for an existing user. */}
                  <p className="mt-6 text-center text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <Link href="/sign-in" className="text-primary underline underline-offset-4">
                      Sign in
                    </Link>
                    .
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
