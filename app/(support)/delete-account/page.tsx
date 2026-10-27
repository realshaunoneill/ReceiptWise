import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Navigation } from '@/components/layout/navigation';

export const metadata: Metadata = {
  title: 'Delete your account - ReceiptWise',
  description: 'How to delete your ReceiptWise account and everything in it, from the app or the website.',
};

/**
 * How to delete an account, public: Google Play asks for a page like this, reachable without
 * signing in, and it answers the same question for everyone else.
 */
export default function DeleteAccountPage() {
  return (
    <>
      <Navigation />
      <main className="container mx-auto max-w-3xl space-y-6 p-4 pb-12 sm:p-6" aria-labelledby="delete-title">
        <div>
          <h1 id="delete-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Delete your account</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:mt-2">Your account and everything in it, from the app or the website.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>How</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>In the app:</strong> Settings, then Delete account.</li>
              <li><strong>On the website:</strong> <Link href="/settings?tab=data" className="text-primary hover:underline">Settings → Data</Link>, then Delete account.</li>
              <li>
                <strong>Can&apos;t sign in?</strong> Email{' '}
                <a href="mailto:support@receiptwise.io?subject=Delete%20my%20account" className="text-primary hover:underline">support@receiptwise.io</a>{' '}
                from the address on your account, and we&apos;ll delete it within 30 days.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What happens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <ul className="list-disc space-y-1 pl-5">
              <li>It happens 24 hours after you ask, so an accidental request can be undone in Settings until then.</li>
              <li>Then your account and everything in it is deleted: receipts and their images, bills and their files, your plan, income, savings goals and balances, and forwarded emails.</li>
              <li>A household you own passes to its longest-standing other member, or is deleted if you were its only member.</li>
              <li>A subscription paid on the website is cancelled for you. One bought in the app through the App Store or Google Play isn&apos;t: cancel it in your phone&apos;s settings, or it keeps renewing.</li>
              <li>Invoices are kept by Stripe for as long as tax law requires. Application logs are deleted on our providers&apos; schedules. The <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link> has the detail.</li>
            </ul>
            <p>Want a copy first? Export your data from the same place in Settings.</p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
