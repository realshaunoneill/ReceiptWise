import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Navigation } from '@/components/layout/navigation';
import { CancelPanel } from '@/components/billing/cancel-panel';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Cancel or withdraw - ReceiptWise',
  description: 'Cancel ReceiptWise Premium, or withdraw from your contract within 14 days of a payment for a full refund.',
  path: '/cancel',
});

/**
 * The "withdraw from contract here" function the EU asks for (lib/billing/withdrawal.ts), public so
 * the footer can link it from every page: signed out, the panel asks you to sign in first.
 */
export default function CancelPage() {
  return (
    <>
      <Navigation />
      <main className="container mx-auto max-w-3xl space-y-6 p-4 pb-12 sm:p-6" aria-labelledby="cancel-title">
        <div>
          <h1 id="cancel-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Cancel or withdraw</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:mt-2">Stop Premium yourself, here, in two steps.</p>
        </div>

        <CancelPanel />

        <Card>
          <CardHeader>
            <CardTitle>Your rights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>During the free trial:</strong> withdraw and Premium stops now. You are never charged.</li>
              <li>
                <strong>Within 14 days of a payment</strong> (the first one after your trial, or any renewal): withdraw and Premium
                stops now, and we refund that payment in full.
              </li>
              <li><strong>After that:</strong> cancel and Premium stays on until the end of the period you paid for, then stops.</li>
              <li>Either way your receipts, bills and plan stay in your account, and you can come back whenever you like.</li>
              <li>
                Bought Premium in the app? The App Store or Google Play bills it, so cancel it in your phone&apos;s settings, or ask
                them for a refund.
              </li>
            </ul>
            <p>
              The <Link href="/refund" className="text-primary hover:underline">refund policy</Link> and the{' '}
              <Link href="/terms" className="text-primary hover:underline">terms</Link> have the detail. Can&apos;t sign in? Email{' '}
              <a href="mailto:support@receiptwise.io?subject=Cancel%20my%20Premium" className="text-primary hover:underline">support@receiptwise.io</a>{' '}
              from the address on your account and we&apos;ll do it for you.
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
