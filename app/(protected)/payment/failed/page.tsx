'use client';
import Link from 'next/link';
import { ArrowLeft, CreditCard, HelpCircle, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/*
 * Stripe's cancel_url. Stripe Checkout shows card declines inline and never redirects on them,
 * so nearly everyone who lands here pressed "Back" on the checkout page — and the old page told
 * them their payment had failed and listed reasons their card might have been declined. It now
 * says what actually happened, and "Try again" returns to the plan choice rather than Settings.
 */
export default function CheckoutNotCompletedPage() {
  return (
    <main className="container mx-auto max-w-4xl space-y-6 p-4 sm:p-6" aria-labelledby="checkout-cancelled-title">
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-8">
        <div className="space-y-2 text-center">
          <h1 id="checkout-cancelled-title" className="text-3xl font-semibold tracking-tight text-foreground">
            Checkout wasn&apos;t completed
          </h1>
          <p className="text-lg text-muted-foreground">
            Nothing has been charged. You can pick up where you left off whenever you like.
          </p>
        </div>

        <div className="flex w-full max-w-md flex-col gap-4 sm:flex-row">
          <Button asChild className="flex-1 gap-2" size="lg">
            <Link href="/upgrade">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1 gap-2" size="lg">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to dashboard
            </Link>
          </Button>
        </div>

        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" aria-hidden="true" />
              If your card was declined
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <CreditCard className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">Try a different card</p>
                  <p className="text-xs text-muted-foreground">
                    Banks sometimes block a first payment to a new merchant; a second card or a quick
                    word with your bank usually sorts it.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <Mail className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">Ask us</p>
                  <p className="text-xs text-muted-foreground">A person reads support email</p>
                </div>
              </div>
            </div>
            <div className="pt-2 text-center">
              <Button asChild variant="link" size="sm">
                <a href="mailto:support@receiptwise.io">Email us at support@receiptwise.io</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
