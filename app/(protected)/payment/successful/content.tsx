'use client';

import Link from 'next/link';
import { CheckCircle, ArrowRight, Receipt, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SuccessContentProps {
  sessionId?: string;
  subscriptionStatus?: string;
  trialEndsAt?: string;
}

export default function SuccessContent({
  sessionId,
  subscriptionStatus,
  trialEndsAt,
}: SuccessContentProps) {
  // The page used to say "Your subscription is active" unconditionally — including to people who
  // had just started a trial and had not been charged, and when the session could not be
  // confirmed at all.
  const trialEndLabel = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const statusLine = trialEndLabel
    ? `Your free trial runs until ${trialEndLabel}. Nothing is charged before then, and you can cancel any time under Settings → Subscription.`
    : subscriptionStatus === 'active'
      ? 'Your subscription is active. Nothing else to do.'
      : 'Thanks — your checkout is complete. If Premium features are not unlocked within a minute, refresh the page.';

  return (
    <main className="container mx-auto max-w-4xl space-y-6 px-4 py-6 sm:p-6" aria-labelledby="payment-success-title">
        <div className="flex flex-col items-center justify-center min-h-[50vh] sm:min-h-[60vh] space-y-6 sm:space-y-8">
          {/*
            The check mark used to sit in an `animate-pulse` circle that never
            stopped throbbing, the heading ended in 🎉, and the card below was
            hardcoded green in both themes with green body text on a green tint.
            A payment confirmation should be calm and legible — it is a receipt for
            a transaction, and the one screen where the product most needs to look
            like it can be trusted with money.
          */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10" aria-hidden="true">
            <CheckCircle className="h-7 w-7 text-success" />
          </div>

          {/* Success Message */}
          <div className="space-y-2 px-2 text-center">
            <h1 id="payment-success-title" className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              You&apos;re all set
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg">
              {statusLine}
            </p>
          </div>

          {/* Features Card */}
          <Card className="w-full max-w-2xl">
            <CardHeader className="px-4 py-4 sm:px-6 sm:py-6">
              <CardTitle className="text-base sm:text-lg">What is open to you now</CardTitle>
              <CardDescription className="text-sm">
                All of it. There is no higher tier.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 sm:space-y-4 sm:px-6 sm:pb-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                {[
                  {
                    icon: Receipt,
                    title: 'Unlimited receipts',
                    body: 'Add as many as you like, each one read and itemised.',
                  },
                  {
                    icon: TrendingUp,
                    title: 'Insights',
                    body: 'Category breakdowns, trends and item history.',
                  },
                  {
                    icon: Users,
                    title: 'Households',
                    body: 'Share a receipt pile with the people you share bills with.',
                  },
                  {
                    icon: CheckCircle,
                    title: 'Export',
                    body: 'Download everything as CSV, JSON or a printable page, any time.',
                  },
                ].map(({ icon: Icon, title, body }) => (
                  <div key={title} className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex w-full max-w-md flex-col gap-3 px-2 sm:flex-row sm:gap-4 sm:px-0">
            <Button asChild className="flex-1 gap-2" size="lg">
              <Link href="/receipts">
                Add a receipt <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1" size="lg">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </div>

          {/* Session Details */}
          {sessionId && (
            <p className="break-all px-4 text-center font-mono text-xs text-muted-foreground">
              Reference: {sessionId}
            </p>
          )}
        </div>
      </main>
  );
}
