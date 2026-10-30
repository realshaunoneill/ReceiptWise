'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Chrome,
  Cloud,
  FileText,
  Lock,
  Receipt,
  Scan,
  Search,
  Shield,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Navigation } from '@/components/layout/navigation';
import { SectionLabel } from '@/components/layout/section-label';
import { HowItWorks } from '@/components/landing/how-it-works';
import { LandingPricing } from '@/components/landing/landing-pricing';
import { ExitIntentPopup } from '@/components/landing/exit-intent-popup';
import { useSession } from '@/lib/auth-client';
import { useAttributionQuery } from '@/lib/hooks/use-attribution';
import { BILLS_LAUNCHED } from '@/lib/public-features';

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

const PLAN_ALT = 'A month in the ReceiptWise plan: what is left after the pay, the bills, the savings and the one-offs, the weekly split, the bank balance until payday, and a bill to file';
const DASHBOARD_ALT = "The ReceiptWise dashboard: this month's receipts and spending, a breakdown by category, weekly trends, the month's plan and the latest receipts";

/*
 * Feature cards used to carry a `gradient` field each — from-orange-500/10,
 * from-purple-500/10, from-violet-500/10 and so on — revealed on hover. Seven
 * unrelated hues assigned in no particular order is decoration standing in for
 * hierarchy, and the purple/pink pair in particular is the house style of every
 * generated SaaS page. The cards are now uniform and the copy does the work.
 */
/*
 * The plan comes first since 2026-10-29: it is what people use, and "see where it went" is free in
 * every bank app. Since 2026-10-30 one Premium covers everyone in a household, up to six people
 * (lib/entitlements.ts decideHouseholdCover), receipts included, and the copy says that limit.
 */
const features = [
  ...(BILLS_LAUNCHED ? [{
    icon: Wallet,
    title: 'Your month, planned',
    description:
      'Your pay, your bills and what is left for each week, payday to payday. A bigger card bill this month? Change that month’s amount and the rest of the plan follows.',
  }, {
    icon: FileText,
    title: 'Bills read for you',
    description:
      'Upload a bill or forward the email to your own ReceiptWise address. It is read for you, and one tap files it against the right bill and month.',
  }, {
    icon: Users,
    title: 'Planned together',
    description:
      'Make a household with your partner or the family. One Premium covers up to six of you, receipts and all, so everyone works from the same month.',
  }] : [{
    icon: Users,
    title: 'Household sharing',
    description:
      'Make a household for your family or your partner. Share a receipt with it and everyone in it sees the same pile.',
  }]),
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
      'Where the money went, by category, over the week, month or year.',
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
    title: 'Kept for tax back',
    // True today without a tax report: receipts are categorised as they arrive, and the Receipts
    // page filters by category and date. Don't promise totals or an export for Revenue until they exist.
    description:
      'Doctor, consultant and pharmacy receipts are sorted into Healthcare and Pharmacy as they arrive, image and all. When it is time to claim tax back from Revenue, the year’s are in one place.',
  },
  {
    icon: Chrome,
    title: 'Chrome extension',
    // Built and working, but not yet listed on the Chrome Web Store, so nobody can install it
    // from here. Selling it as available would be a claim the site cannot back up.
    badge: 'Coming to the Chrome Web Store',
    description:
      'Online orders and emailed receipts never get printed. Clip them from the page instead.',
  },
];

// NOTE: no usage/user-count stats here on purpose. Anything claimed on this page has to
// be independently true. Add real numbers only once they are real and measured.

const benefits = BILLS_LAUNCHED
  ? [
    'One Premium covers up to six people in a household',
    'Bills, savings and a weekly split, payday to payday',
    // Plan → Paste a list takes lines straight from a spreadsheet (lib/plan/parse-lines.ts).
    'Paste your budget spreadsheet straight in',
    'Nothing connects to your bank',
    'Receipts shared with the household as they arrive',
    'Split view: shared, personal, or both',
  ]
  : [
    'Receipts shared with the household as they arrive',
    'Everything categorised as it arrives',
    'Split view: shared, personal, or both',
    'Export for an accountant or a tax return',
    'Shared subscriptions tracked alongside receipts',
    'Find any receipt by something on it',
  ];

/**
 * `initialSignedIn` comes from the server (app/page.tsx), so the first HTML already has the right
 * buttons. Every call to action used to be a skeleton until the browser had checked the session,
 * which left the server-rendered page with no "Sign in", no trial button and no hero action.
 */
export function LandingPage({ initialSignedIn = false }: { initialSignedIn?: boolean }) {
  const { data: session, isPending } = useSession();
  const isSignedIn = isPending ? initialSignedIn : Boolean(session);
  // How this visit arrived, carried on to sign-up so a new account records it (shared/attribution.ts).
  const attribution = useAttributionQuery();

  // Header component that handles loading state gracefully
  const Header = () => {
    if (isSignedIn) {
      return <Navigation />;
    }

    return (
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="ReceiptWise Home">
            <img src="/logo-mark.png" alt="" width={32} height={32} className="h-8 w-8" aria-hidden="true" />
            <span className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">ReceiptWise</span>
          </Link>
          <div className="flex items-center gap-2">
            {/* Off on the narrowest phones, where it ran into the wordmark; pricing is a scroll away. */}
            <Button variant="ghost" size="sm" className="hidden min-[400px]:inline-flex" onClick={() => scrollToSection('pricing')}>
              Pricing
            </Button>
            <ThemeToggle />
            <Button asChild>
              <Link href={`/sign-in${attribution}`}>Sign in</Link>
            </Button>
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
            {BILLS_LAUNCHED ? 'Know what’s left until payday.' : 'One receipt drawer for the whole household.'}
          </h1>
          {/* No "housemates … tired of asking who paid": there is no splitting or settling up, so
              that promised a feature the app doesn't have. */}
          <p className="mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
            {BILLS_LAUNCHED
              ? 'Your pay, your bills and your spending in one plan, from one payday to the next, and shared with your partner if you like. Photograph receipts and forward bills, and they are read and filed for you. Nothing connects to your bank.'
              : 'Photograph a receipt and it is filed, itemised and searchable — for you and for your family or partner.'}
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            {isSignedIn ? (
              <Button asChild size="lg" className="gap-2">
                <Link href="/dashboard">
                  Go to dashboard
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="gap-2">
                  <Link href={`/sign-up${attribution}`}>
                    {HAS_TRIAL ? 'Start the free trial' : 'Create an account'}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
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
          {!isSignedIn && HAS_TRIAL && (
            <p className="mt-4 text-sm text-muted-foreground">
              {TRIAL_DAYS} days free. Cancel during the
              trial and you are not charged.
            </p>
          )}
        </div>

        {/* Product preview */}
        <div className="mx-auto mt-20 w-full max-w-6xl">
          <div className="overflow-hidden rounded-xl border bg-card shadow-2xl shadow-foreground/5">
            {/* WebP at 1600px wide (~50 KB each). On a phone the desktop capture shrank to about
                340px and its text was unreadable, so phones get a phone capture instead (780px,
                ~33 KB). Light and dark are separate pictures because the theme is a class, not
                prefers-color-scheme. With the plan launched, the hero shows the Plan, which is what
                the headline sells (captured 2026-10-29 from the staging household, as persona data). */}
            {BILLS_LAUNCHED ? (
              <>
                <picture className="block dark:hidden">
                  <source media="(max-width: 639px)" srcSet="/plan-mobile-light.webp" width={780} height={1200} />
                  <img src="/plan-full-light.webp" alt={PLAN_ALT} width={1600} height={1640} className="h-auto w-full" />
                </picture>
                <picture className="hidden dark:block">
                  <source media="(max-width: 639px)" srcSet="/plan-mobile-dark.webp" width={780} height={1200} />
                  <img src="/plan-full-dark.webp" alt={PLAN_ALT} width={1600} height={1640} className="h-auto w-full" />
                </picture>
              </>
            ) : (
              <>
                <picture className="block dark:hidden">
                  <source media="(max-width: 639px)" srcSet="/dashboard-mobile-light.webp" width={780} height={1200} />
                  <img src="/dashboard-full-light.webp" alt={DASHBOARD_ALT} width={1600} height={1639} className="h-auto w-full" />
                </picture>
                <picture className="hidden dark:block">
                  <source media="(max-width: 639px)" srcSet="/dashboard-mobile-dark.webp" width={780} height={1200} />
                  <img src="/dashboard-full-dark.webp" alt={DASHBOARD_ALT} width={1600} height={1639} className="h-auto w-full" />
                </picture>
              </>
            )}
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
              Everything here works today, apart from the one marked as coming.
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
                  {'badge' in feature && feature.badge && (
                    <p className="mt-1 text-xs font-medium text-muted-foreground">{feature.badge}</p>
                  )}
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              );
            })}
            {/* Fills the last row so the grid keeps its edge. */}
            {Array.from({ length: (3 - (features.length % 3)) % 3 }, (_, i) => (
              <div key={`filler-${i}`} className="hidden bg-card lg:block" aria-hidden="true" />
            ))}
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
                {BILLS_LAUNCHED
                  ? 'Most budgeting apps assume one person, one wallet. This one assumes a kitchen table. The pay, the bills and the receipts go into a household, and everyone in it plans the same month.'
                  : 'Most expense trackers assume one person, one wallet. This one assumes a kitchen table. Receipts go into a household, and everyone in it sees the same picture of what was spent and by whom.'}
              </p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-sm text-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
              {isSignedIn ? (
                <Button asChild size="lg" className="mt-8 gap-2">
                  <Link href="/dashboard">
                    Go to dashboard
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="mt-8 gap-2">
                  <Link href={`/sign-up${attribution}`}>
                    {HAS_TRIAL ? 'Start the free trial' : 'Create an account'}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </div>
            <div className="order-1 lg:order-2">
              <div className="overflow-hidden rounded-xl border bg-card shadow-xl shadow-foreground/5">
                {/* Light mode screenshot */}
                <img
                  src="/sharing-light.webp"
                  alt="A ReceiptWise household: its two members, and the receipts each of them has shared with it"
                  width={1600}
                  height={1187}
                  loading="lazy"
                  className="h-auto w-full dark:hidden"
                />
                {/* Dark mode screenshot */}
                <img
                  src="/sharing-dark.webp"
                  alt="A ReceiptWise household: its two members, and the receipts each of them has shared with it"
                  width={1600}
                  height={1187}
                  loading="lazy"
                  className="hidden h-auto w-full dark:block"
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
              {BILLS_LAUNCHED && ' One Premium covers up to six people in your household.'}
              {HAS_TRIAL && ` Try all of it free for ${TRIAL_DAYS} days.`}
            </p>
          </div>

          {/* One paid plan with a free trial, by decision — there is no free tier. The €0
              card that used to sit here advertised 5 receipts/month, which the API
              rejected with a 403. */}
          <LandingPricing isSignedIn={isSignedIn} attribution={attribution} />
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
                Served over TLS, and encrypted at rest by our hosting and database providers.
                You sign in with Google and pay through Stripe, so there is no password here to
                leak, and we never see your card details.
              </p>
            </div>
            <div>
              <Cloud className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="mt-4 font-semibold text-foreground">Used only to run the app</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Receipts{BILLS_LAUNCHED && ', and bills you upload or forward,'} are read by AI
                models (Google&apos;s Gemini, with OpenAI as a back-up), and your spending totals
                write your summaries. Only providers that keep nothing and never train on it are
                used.
              </p>
            </div>
            <div>
              <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="mt-4 font-semibold text-foreground">Yours to take or delete</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Export everything as CSV, JSON, or HTML with the images whenever you like, and
                delete your account and its data from Settings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-primary px-4 py-20" aria-labelledby="cta-title">
        <div className="mx-auto max-w-3xl">
          <h2 id="cta-title" className="text-3xl font-semibold tracking-tight text-primary-foreground sm:text-4xl">
            {isSignedIn
              ? 'Your dashboard is waiting.'
              : BILLS_LAUNCHED ? 'Start with this month’s pay.' : 'Start with the receipt in your pocket.'}
          </h2>
          <p className="mt-4 max-w-xl text-lg text-primary-foreground/85">
            {isSignedIn
              ? 'Pick up where you left off and see where this month has gone.'
              : `${BILLS_LAUNCHED
                ? 'Add your pay and your main bills, and you will see what is left for each week.'
                : 'Photograph one receipt and you will see the whole thing work.'}${
                HAS_TRIAL ? ` ${TRIAL_DAYS} days free, cancel any time before it ends.` : ''
              }`}
          </p>
          {isSignedIn ? (
            /* On the emerald band, an explicit inverse rather than variant="secondary":
               secondary is a mid slate in dark mode, which on green reads as
               muddy rather than as the obvious thing to press. */
            <Button asChild size="lg" className="mt-8 gap-2 bg-background text-foreground hover:bg-background/90">
              <Link href="/dashboard">
                Go to dashboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="mt-8 gap-2 bg-background text-foreground hover:bg-background/90">
              <Link href={`/sign-up${attribution}`}>
                {HAS_TRIAL ? 'Start the free trial' : 'Create an account'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          )}
        </div>
      </section>
      </main>

      {/* Exit Intent Popup - only for non-signed-in users */}
      {!isPending && !isSignedIn && <ExitIntentPopup attribution={attribution} />}
    </div>
  );
}
