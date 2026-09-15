'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Mail, RefreshCw, CreditCard, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function PaymentFailedPage() {
  const router = useRouter();

  const commonErrorReasons = [
    {
      title: 'Insufficient funds',
      content:
        "Your card doesn't have enough funds to complete this purchase. Please try a different payment method or contact your bank.",
    },
    {
      title: 'Card declined',
      content:
        'Your card was declined by the issuing bank. This could be due to temporary holds, daily spending limits, or fraud protection measures.',
    },
    {
      title: 'Incorrect card information',
      content:
        "The card details you entered (number, expiration date, CVV, or billing address) don't match what your bank has on file.",
    },
    {
      title: 'Expired card',
      content: 'Your card has expired. Please update your payment information with a valid card.',
    },
    {
      title: 'Technical issue',
      content:
        'We encountered a technical issue while processing your payment. This is usually temporary and resolves quickly.',
    },
  ];

  return (
    <main className="container mx-auto max-w-4xl space-y-6 p-4 sm:p-6" aria-labelledby="payment-failed-title">
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
          {/* Was a permanently pulsing red halo behind the triangle, and the card
              below was hardcoded red-on-red in both themes. A declined card is a
              routine, fixable event; the page should not read like an alarm. */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10" aria-hidden="true">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>

          {/* Error Message */}
          <div className="space-y-2 text-center">
            <h1 id="payment-failed-title" className="text-3xl font-semibold tracking-tight text-foreground">
              That payment didn&apos;t go through
            </h1>
            <p className="text-lg text-muted-foreground">
              Nothing has been charged, and you can try again whenever you like.
            </p>
          </div>

          {/* Error Card */}
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Why this usually happens</CardTitle>
              <CardDescription>
                Almost always one of these, and almost always fixable on a second attempt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Accordion type="single" collapsible className="w-full">
                  {commonErrorReasons.map((reason, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger className="text-sm">{reason.title}</AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">
                        {reason.content}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
            <Button
              onClick={() => router.push('/settings')}
              className="flex-1 gap-2"
              size="lg"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
            <Button
              asChild
              variant="outline"
              className="flex-1 gap-2"
              size="lg"
            >
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to dashboard
              </Link>
            </Button>
          </div>

          {/* Help Section */}
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" aria-hidden="true" />
                If it keeps failing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <CreditCard className="h-5 w-5 text-primary mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">Try a different card</p>
                    <p className="text-xs text-muted-foreground">Often the fastest fix</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Mail className="h-5 w-5 text-primary mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">Ask us</p>
                    <p className="text-xs text-muted-foreground">A person reads support email</p>
                  </div>
                </div>
              </div>
              <div className="text-center pt-2">
                <Button asChild variant="link" size="sm">
                  <Link href="mailto:support@receiptwise.io">
                    Email us at support@receiptwise.io
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
  );
}
