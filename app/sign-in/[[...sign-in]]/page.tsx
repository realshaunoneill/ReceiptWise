import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScanLine, BarChart3, Users, CheckCircle2 } from 'lucide-react';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="ReceiptWise" className="h-8 w-auto" />
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
                  Welcome back
                </h1>
                <p className="mt-4 text-lg text-muted-foreground">
                  Your receipts and your household are where you left them.
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
                      One receipt pile for everyone who shares the bills.
                    </p>
                  </div>
                </div>
              </div>

              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-6">
                  <ul className="space-y-3">
                    {[
                      'Free trial, cancel any time',
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
                  {/*
                    Google is the only sign-in method enabled on this Clerk instance —
                    no password, no email code, no first-factor strategy of any kind.
                    An earlier draft of this line read "With Google, or with the email
                    address you signed up with", which offered a route that does not
                    exist. Since Google both signs in and registers, there is also no
                    separate sign-up to send anyone to.
                  */}
                  <div className="mb-8">
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                      Sign in
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      ReceiptWise uses your Google account. The same button gets you in
                      whether you have been here before or not.
                    </p>
                  </div>

                  <div className="flex justify-center">
                    {/*
                      Clerk ships its own light palette, and only the outer card
                      was being neutralised — so in dark mode the sign-in form sat
                      on this page as a white rectangle with black text, the one
                      element that had not been themed. Clerk's appearance variables
                      accept any CSS colour value, so pointing them at the same
                      custom properties the rest of the app uses makes the form
                      follow the theme (and the typeface) for free.
                    */}
                    <SignIn
                      appearance={{
                        variables: {
                          colorPrimary: 'var(--primary)',
                          colorBackground: 'var(--card)',
                          colorText: 'var(--card-foreground)',
                          colorTextSecondary: 'var(--muted-foreground)',
                          colorInputBackground: 'var(--background)',
                          colorInputText: 'var(--foreground)',
                          colorNeutral: 'var(--foreground)',
                          colorDanger: 'var(--destructive)',
                          borderRadius: 'var(--radius)',
                          fontFamily: 'var(--font-plex-sans)',
                        },
                        /*
                          Every override below carries Tailwind's `!` important
                          modifier, and it is load-bearing.

                          Clerk injects its own stylesheet after Tailwind's, and its
                          internal per-element class (`cl-internal-*`) has the same
                          single-class specificity as a utility. Source order
                          therefore decides, and Clerk wins: a plain `hidden` landed
                          on the element and still computed to `display: flex`. That
                          is why the previous `footer: 'hidden'` in this file never
                          did anything.
                        */
                        elements: {
                          rootBox: 'w-full',
                          // Clerk wraps `card` in a `cardBox`, and the card itself
                          // keeps a solid background — together they were the
                          // box-inside-a-box sitting inside this page's own Card.
                          cardBox: 'shadow-none! border-0! bg-transparent! w-full',
                          card: 'shadow-none! border-0! bg-transparent! p-0! gap-6',
                          // The Clerk logo is a fixed-colour asset that washes out on
                          // a dark surface, and the wordmark is already in the header
                          // of this page. Drop the whole header block.
                          header: 'hidden!',
                          logoBox: 'hidden!',
                          headerTitle: 'hidden!',
                          headerSubtitle: 'hidden!',
                          formButtonPrimary: 'bg-primary! hover:bg-primary/90!',
                          formFieldInput: 'border-input!',
                          // `border!` for the width as well as `border-border!` for the
                          // colour — overriding only the colour left the button as
                          // bare text with an icon, because neutralising the card also
                          // took this button's own border with it.
                          socialButtonsBlockButton:
                            'border! border-border! bg-background! text-foreground! h-10! hover:bg-muted!',
                          socialButtonsBlockButtonText: 'text-sm! font-medium!',
                          // `footer` is the "Secured by Clerk" row; `footerAction` is
                          // the "Don't have an account? Sign up" row. The latter is a
                          // separate element, which is why hiding `footer` alone left
                          // it on screen — and it pointed at /sign-up, which does not
                          // exist. With Google-only auth there is nothing to link to.
                          footer: 'hidden!',
                          footerAction: 'hidden!',
                        },
                      }}
                      routing="path"
                      path="/sign-in"
                      forceRedirectUrl="/redirect"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
