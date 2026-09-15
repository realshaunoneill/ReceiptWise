'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Chrome,
  Cloud,
  Lock,
  Receipt,
  Scan,
  Search,
  Shield,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Navigation } from '@/components/layout/navigation';
import { SectionLabel } from '@/components/layout/section-label';
import { HowItWorks } from '@/components/landing/how-it-works';
import { LandingPricing } from '@/components/landing/landing-pricing';
import { ExitIntentPopup } from '@/components/landing/exit-intent-popup';
import { useUser } from '@clerk/nextjs';

const scrollToSection = (id: string) => {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
};

/*
 * Trial length, derived exactly the way `createCheckoutSession` in lib/stripe.ts
 * derives it.
 *
 * Two places on this page previously read
 * `process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS || '7'` — so with the variable
 * unset the page promised "free for 7 days" while the checkout code, which gates
 * on `trialDays > 0`, sent Stripe no trial at all. The page would have been
 * advertising a week that nobody received. There is no fallback now: if the
 * variable is absent or zero, no trial is mentioned anywhere.
 */
const TRIAL_DAYS = process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS
  ? parseInt(process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS, 10)
  : 0;
const HAS_TRIAL = TRIAL_DAYS > 0 && !Number.isNaN(TRIAL_DAYS);

/*
 * Feature cards used to carry a `gradient` field each — from-orange-500/10,
 * from-purple-500/10, from-violet-500/10 and so on — revealed on hover. Seven
 * unrelated hues assigned in no particular order is decoration standing in for
 * hierarchy, and the purple/pink pair in particular is the house style of every
 * generated SaaS page. The cards are now uniform and the copy does the work.
 */
const features = [
  {
    icon: Users,
    title: 'Household sharing',
    description:
      'Make a household for your family, your partner or your flatmates. Anyone in it can add a receipt, and everyone sees the same pile.',
  },
  {
    icon: Scan,
    title: 'Receipts read for you',
    description:
      'Merchant, date, total, tax and every line item are pulled off the image. You are not typing any of it in.',
  },
  {
    icon: BarChart3,
    title: 'Spending analytics',
    description:
      'Where the money went, by category and by person, over the week, month or year.',
  },
  {
    icon: Search,
    title: 'Search down to the line item',
    description:
      'Find the receipt by shop, by category, or by something on it. "Coffee beans" will find the shop you bought them in.',
  },
  {
    icon: Cloud,
    title: 'Everywhere at once',
    description:
      'Add a receipt on your phone in the car park and it is on your partner’s dashboard before you have driven home.',
  },
  {
    icon: Receipt,
    title: 'Kept, not lost',
    description:
      'The image stays with the data. Useful when a warranty claim or an expense audit turns up eighteen months later.',
  },
  {
    icon: Chrome,
    title: 'Chrome extension',
    description:
      'Online orders and emailed receipts never get printed. Clip them from the page instead.',
  },
];

// NOTE: no usage/user-count stats here on purpose. Anything claimed on this page has to
// be independently true. Add real numbers only once they are real and measured.

const benefits = [
  'Anyone in the household can add a receipt',
  'Everything categorised as it arrives',
  'Split view: shared, personal, or both',
  'Export for an accountant or a tax return',
  'Shared subscriptions tracked alongside receipts',
  'Clip online receipts from the browser',
];

export default function LandingPage() {
  const { isLoaded, isSignedIn } = useUser();

  // Header component that handles loading state gracefully
  const Header = () => {
    // If loaded and signed in, show full navigation
    if (isLoaded && isSignedIn) {
      return <Navigation />;
    }

    // Show landing header (works for both loading and not-signed-in states)
    // This prevents the flash because we show the same header during loading
    return (
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="ReceiptWise Home">
            <img src="/logo.png" alt="" className="h-8 w-auto" aria-hidden="true" />
            <span className="text-xl font-semibold tracking-tight text-foreground">ReceiptWise</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => scrollToSection('pricing')}>
              Pricing
            </Button>
            <ThemeToggle />
            {!isLoaded ? (
              // Show skeleton button while loading to prevent flash
              <Skeleton className="h-9 w-[68px] rounded-md" />
            ) : (
              <Link href="/sign-in">
                <Button>Sign in</Button>
              </Link>
            )}
          </div>
        </div>
      </header>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Skip Navigation Link for Accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-100 focus:top-4 focus:left-4 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg">
        Skip to main content
      </a>
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <main id="main-content">
      <section className="relative overflow-hidden px-4 py-20 sm:py-28" aria-labelledby="hero-title">
        {/* One soft wash from the top. The previous hero stacked a linear
            gradient and a hardcoded rgba radial gradient on top of each other. */}
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-primary/6 via-transparent to-transparent dark:from-primary/10" />

        <div className="mx-auto max-w-3xl">
          {/*
            No "✨ Now with AI-powered receipt scanning" pill and no half-gradient
            headline. Both are the signature of a page nobody wrote, and the
            gradient clip-text also dropped the descenders' contrast.
          */}
          <h1
            id="hero-title"
            className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl"
          >
            One receipt drawer for the whole household.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
            Photograph a receipt and it is filed, itemised and searchable — for you and
            for everyone you share the bills with. Built for families, couples and
            flatmates who are tired of asking who paid for what.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            {!isLoaded ? (
              // Show skeleton buttons while loading
              <>
                <Skeleton className="h-10 w-44 rounded-md" />
                <Skeleton className="h-10 w-40 rounded-md" />
              </>
            ) : isSignedIn ? (
              <Link href="/dashboard">
                <Button size="lg" className="gap-2">
                  Go to dashboard
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/sign-up">
                  <Button size="lg" className="gap-2">
                    {HAS_TRIAL ? 'Start the free trial' : 'Create an account'}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => scrollToSection('how-it-works')}
                >
                  See how it works
                </Button>
              </>
            )}
          </div>
          {isLoaded && !isSignedIn && HAS_TRIAL && (
            <p className="mt-4 text-sm text-muted-foreground">
              {TRIAL_DAYS} days free. Cancel during the
              trial and you are not charged.
            </p>
          )}
        </div>

        {/* Dashboard Preview */}
        <div className="mx-auto mt-20 w-full max-w-6xl">
          <div className="overflow-hidden rounded-xl border bg-card shadow-2xl shadow-foreground/5">
            {/* Light mode screenshot */}
            <img
              src="/dashboard-full-light.png"
              alt="The ReceiptWise dashboard, showing spending totals, a category breakdown and a list of recent receipts"
              className="w-full dark:hidden"
            />
            {/* Dark mode screenshot */}
            <img
              src="/dashboard-full-dark.png"
              alt="The ReceiptWise dashboard, showing spending totals, a category breakdown and a list of recent receipts"
              className="hidden w-full dark:block"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="scroll-mt-20 border-t px-4 py-20" aria-labelledby="features-title">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 max-w-2xl">
            <SectionLabel index="01">Features</SectionLabel>
            <h2 id="features-title" className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              What it actually does
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              All of it works today. Nothing on this page is a roadmap.
            </p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                /* A hairline grid rather than seven floating cards with seven
                   shadows — closer to a table of contents, which is what it is. */
                <div
                  key={feature.title}
                  className="group bg-card p-6 transition-colors hover:bg-muted/40"
                >
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h3 className="mt-4 font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              );
            })}
            {/* Fills the seventh cell's row so the grid keeps its edge. */}
            <div className="hidden bg-card lg:block" aria-hidden="true" />
            <div className="hidden bg-card lg:block" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="border-t bg-muted/30 px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <SectionLabel index="02">Sharing</SectionLabel>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Built for money that is shared
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Most expense trackers assume one person, one wallet. This one assumes a
                kitchen table. Receipts go into a household, and everyone in it sees the
                same picture of what was spent and by whom.
              </p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-sm text-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
              {!isLoaded ? (
                <Skeleton className="mt-8 h-10 w-[180px] rounded-md" />
              ) : isSignedIn ? (
                <Link href="/dashboard" className="mt-8 inline-block">
                  <Button size="lg" className="gap-2">
                    Go to dashboard
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
              ) : (
                <Link href="/sign-up" className="mt-8 inline-block">
                  <Button size="lg" className="gap-2">
                    {HAS_TRIAL ? 'Start the free trial' : 'Create an account'}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
              )}
            </div>
            <div className="order-1 lg:order-2">
              <div className="overflow-hidden rounded-xl border bg-card shadow-xl shadow-foreground/5">
                {/* Light mode screenshot */}
                <img
                  src="/sharing-light.png"
                  alt="A ReceiptWise household, listing its members and the receipts each of them has added"
                  className="w-full dark:hidden"
                />
                {/* Dark mode screenshot */}
                <img
                  src="/sharing-dark.png"
                  alt="A ReceiptWise household, listing its members and the receipts each of them has added"
                  className="hidden w-full dark:block"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <HowItWorks />

      {/* Pricing Section */}
      <section id="pricing" className="scroll-mt-20 border-t bg-muted/30 px-4 py-20" aria-labelledby="pricing-title">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 max-w-2xl">
            <SectionLabel index="04">Pricing</SectionLabel>
            <h2 id="pricing-title" className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              One plan, everything included
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              There is no feature matrix to study and nothing held back for a higher tier.
              {HAS_TRIAL && ` Try all of it free for ${TRIAL_DAYS} days.`}
            </p>
          </div>

          {/* A free tier is not implemented yet — see P1-1 in the readiness plan. The
              €0 card that used to sit here advertised 5 receipts/month, which the API
              rejected with a 403. It comes back when the €0 Stripe price is live. */}
          <LandingPricing isSignedIn={Boolean(isLoaded && isSignedIn)} />
        </div>
      </section>

      {/* Security Section */}
      <section className="border-t px-4 py-20" aria-labelledby="security-title">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 max-w-2xl">
            <SectionLabel index="05">Your data</SectionLabel>
            <h2 id="security-title" className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              How your data is handled
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Receipts are financial records, so here is plainly what happens to them — and
              what you can do about it. Full detail is in the{' '}
              <Link href="/privacy" className="text-foreground underline underline-offset-4 hover:text-primary">
                privacy policy
              </Link>
              .
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="mt-4 font-semibold text-foreground">Encrypted in transit &amp; at rest</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Served over TLS. Sign-in is handled by Clerk and payments by Stripe, so we
                never store your password or card details.
              </p>
            </div>
            <div>
              <Cloud className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="mt-4 font-semibold text-foreground">Used only to read your receipts</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Images go to OpenAI for text extraction and nothing else. Per OpenAI&apos;s
                API terms they are not used to train their models.
              </p>
            </div>
            <div>
              <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="mt-4 font-semibold text-foreground">Yours to take or delete</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Export everything as CSV or JSON whenever you like, and delete your
                account and its data from Settings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-primary px-4 py-20" aria-labelledby="cta-title">
        <div className="mx-auto max-w-3xl">
          <h2 id="cta-title" className="text-3xl font-semibold tracking-tight text-primary-foreground sm:text-4xl">
            {isLoaded && isSignedIn
              ? 'Your dashboard is waiting.'
              : 'Start with the receipt in your pocket.'}
          </h2>
          <p className="mt-4 max-w-xl text-lg text-primary-foreground/85">
            {isLoaded && isSignedIn
              ? 'Pick up where you left off and see where this month has gone.'
              : `Photograph one receipt and you will see the whole thing work.${
                HAS_TRIAL ? ` ${TRIAL_DAYS} days free, cancel any time before it ends.` : ''
              }`}
          </p>
          {!isLoaded ? (
            <Skeleton className="mt-8 h-10 w-[200px] rounded-md bg-primary-foreground/20" />
          ) : isSignedIn ? (
            <Link href="/dashboard" className="mt-8 inline-block">
              {/* On the emerald band, an explicit inverse rather than variant="secondary":
                  secondary is a mid slate in dark mode, which on green reads as
                  muddy rather than as the obvious thing to press. */}
              <Button size="lg" className="gap-2 bg-background text-foreground hover:bg-background/90">
                Go to dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          ) : (
            <Link href="/sign-up" className="mt-8 inline-block">
              {/* On the emerald band, an explicit inverse rather than variant="secondary":
                  secondary is a mid slate in dark mode, which on green reads as
                  muddy rather than as the obvious thing to press. */}
              <Button size="lg" className="gap-2 bg-background text-foreground hover:bg-background/90">
                Create an account
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          )}
        </div>
      </section>
      </main>

      {/* Exit Intent Popup - only for non-signed-in users */}
      {isLoaded && !isSignedIn && <ExitIntentPopup />}
    </div>
  );
}
