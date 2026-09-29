'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Navigation } from '@/components/layout/navigation';

export default function PrivacyPage() {
  return (
    <>
      <Navigation />
      <main className="container mx-auto max-w-4xl space-y-6 p-4 sm:p-6 pb-12" aria-labelledby="privacy-title">
        <div>
          <h1 id="privacy-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Privacy Policy</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:mt-2">
            Last updated: September 29, 2026
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Who we are</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-3">
            {/* TODO(operator): GDPR Art. 13(1)(a) requires the controller's identity. Add the
                operator's legal name (or company name and number) and a postal address here
                before relying on this policy. Deliberately not filled in by guesswork. */}
            <p>
              ReceiptWise (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is a receipt and household expense
              service operated from Ireland. We are the controller of the personal data described in this
              policy. For anything about your data, contact <a href="mailto:support@receiptwise.io" className="text-primary hover:underline">support@receiptwise.io</a>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Information we collect</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-3">
            <p><strong>Account information:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your email address, and the name on your sign-in account, via Clerk</li>
              <li>Settings you choose, such as your currency and default household</li>
            </ul>

            <p><strong>Receipt data:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Receipt images you upload, from the website or the Chrome extension</li>
              <li>What is read off them: merchant, items, prices, dates, payment method, and any loyalty or VAT numbers printed on the receipt</li>
              <li>Categories, business-expense flags and notes you add</li>
              <li>Recurring subscriptions you choose to track</li>
            </ul>

            <p><strong>Usage information (only if you accept analytics):</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Pages visited and features used, browser and device type</li>
              <li>Session recordings of how you move through the app, with everything you type and every amount masked before it leaves your browser</li>
            </ul>

            <p><strong>Payment information:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Card details are collected and stored by Stripe; we never see or store your full card number</li>
              <li>We store your Stripe customer ID and whether your subscription is active</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. How we use it, and on what legal basis</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-3">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Running the service you signed up for</strong> — storing and reading your receipts, sharing them with your household, producing insights, and billing your subscription. Basis: performance of our contract with you (GDPR Art. 6(1)(b)).</li>
              <li><strong>Keeping it working and secure</strong> — application logs used to find and fix faults, and to detect abuse. Basis: our legitimate interest in running a reliable, secure service (Art. 6(1)(f)).</li>
              <li><strong>Product analytics and session recordings</strong> — understanding where the app gets in people&apos;s way. Basis: your consent (Art. 6(1)(a)), which you can withdraw at any time from &quot;Cookie settings&quot; at the bottom of any page.</li>
              <li><strong>Legal obligations</strong> — for example keeping invoices for tax purposes. Basis: legal obligation (Art. 6(1)(c)).</li>
              <li><strong>Answering you</strong> when you contact support. Basis: legitimate interests, or our contract with you.</li>
            </ul>
            <p>We do not sell your data, and we do not send marketing email.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. How receipts are read</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-3">
            <p>
              Receipts are read by OpenAI&apos;s models through their API: images are sent to <strong>GPT-4o</strong>
              to extract the merchant, items and totals, and summarised spending figures are sent to
              <strong> GPT-4o-mini</strong> to write your spending summaries.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>OpenAI does not use API data to train its models</li>
              <li>OpenAI may keep API inputs for a limited period (currently up to 30 days) to monitor for abuse, and then deletes them</li>
              <li>We store what comes back in our own database</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Who processes your data for us</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-3">
            <p>We use these service providers to run ReceiptWise. They process data on our behalf and only for these purposes:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Clerk</strong> — sign-in and account management</li>
              <li><strong>Stripe</strong> — subscriptions and payments</li>
              <li><strong>OpenAI</strong> — reading receipts and writing spending summaries (see section 4)</li>
              <li><strong>Vercel</strong> — hosting, receipt image storage (Vercel Blob) and cookieless page-view statistics (Vercel Analytics)</li>
              <li><strong>Neon</strong> — our Postgres database, hosted in the London (eu-west-2) region</li>
              <li><strong>PostHog</strong> (EU cloud) — product analytics and session recordings, only if you accept analytics; your email address is attached to your analytics profile so we can answer support questions about it</li>
              <li><strong>Rapid7 InsightOps</strong> (EU region) — application logs. Logs identify you by an internal account ID (email addresses are removed before logs are sent) and can include the contents of receipts being processed. They are used only to diagnose faults and abuse</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>6. International transfers</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-3">
            <p>
              Some of these providers are based in the United States or process data there (for example Clerk,
              Stripe, OpenAI and Vercel). Where personal data leaves the European Economic Area, the transfer is
              covered by the EU–US Data Privacy Framework where the provider is certified under it, or by the
              European Commission&apos;s Standard Contractual Clauses. You can ask us for details of the
              safeguard used for a particular provider. Our database is in the United Kingdom, which the European
              Commission recognises as providing adequate protection.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>7. Storage and security</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-3">
            <ul className="list-disc pl-5 space-y-1">
              <li>Data is encrypted in transit (TLS) and at rest by our hosting and database providers</li>
              <li>Receipt images are stored at long, unguessable addresses; anyone holding an image&apos;s address can open it, so treat shared links with care</li>
              <li>Sign-in is handled by Clerk, and payments by Stripe, which is PCI DSS certified</li>
              <li>Access to production data is restricted to the operator of the service</li>
            </ul>
            <p>No method of transmission or storage is completely secure, and we cannot guarantee absolute security.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>8. Household sharing</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-3">
            <p>When you create or join a household:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Receipts assigned to the household are visible to every member, including images and extracted details</li>
              <li>The household owner can remove members</li>
              <li>You can leave a household, or move your receipts out of it, at any time</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>9. How long we keep it</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-3">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Receipts you delete</strong> disappear from the app immediately, and are purged — image included — within 30 days</li>
              <li><strong>Deleting your account</strong> takes effect 24 hours after you ask (so an accidental request can be undone). We then cancel your subscription and delete your account, receipts and images</li>
              <li><strong>Invoices</strong> are kept by Stripe for as long as tax law requires</li>
              <li><strong>Application logs, analytics and session recordings</strong> are deleted automatically on our providers&apos; retention schedules, and are not used to rebuild anything you have deleted</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>10. Your rights</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-3">
            <p>Under the GDPR you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Have inaccurate data corrected</li>
              <li>Have your data erased</li>
              <li>Receive your data in a portable format — Settings &rarr; Data lets you export everything at any time</li>
              <li>Object to processing based on legitimate interests, or restrict it</li>
              <li>Withdraw consent to analytics at any time, from &quot;Cookie settings&quot;</li>
            </ul>
            <p>
              To exercise any of these, use Settings in the app or email <a href="mailto:support@receiptwise.io" className="text-primary hover:underline">support@receiptwise.io</a>. If you are unhappy with how we
              handle your data, you can complain to Ireland&apos;s Data Protection Commission
              (<a href="https://www.dataprotection.ie" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">dataprotection.ie</a>)
              or to the supervisory authority where you live.
            </p>
          </CardContent>
        </Card>

        <Card id="cookies" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>11. Cookies and similar storage</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-3">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Essential — always on.</strong> Clerk&apos;s session cookies keep you signed in. The service cannot work without them, so they do not need consent.</li>
              <li><strong>Analytics — only with consent.</strong> PostHog stores an identifier in a cookie and in local storage to recognise your visits. Nothing from PostHog loads until you choose &quot;Accept&quot;.</li>
              <li>Your consent choice itself is remembered in your browser&apos;s local storage.</li>
              <li>Vercel Analytics counts page views without cookies.</li>
            </ul>
            <p>You can change your choice at any time from &quot;Cookie settings&quot; at the bottom of any page.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>12. Children</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-3">
            <p>
              ReceiptWise is not intended for anyone under 16, and we do not knowingly collect personal data from
              children. If you believe a child has given us personal data, please contact us and we will delete it.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>13. Changes to this policy</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-3">
            <p>
              We may update this policy. When we do, the date at the top of this page changes, and the previous
              version is available on request.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>14. Contact</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-3">
            <p>
              Questions about this policy or your data: <a href="mailto:support@receiptwise.io" className="text-primary hover:underline">support@receiptwise.io</a>.
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
