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
            Last updated: 27 October 2026
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Who we are</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              ReceiptWise (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is a receipt and household expense
              service run by Shaun O&apos;Neill in Ireland, who is the controller of the personal data described
              in this policy. For anything about your data, contact{' '}
              <a href="mailto:support@receiptwise.io" className="text-primary hover:underline">support@receiptwise.io</a>,
              or Shaun directly at{' '}
              <a href="mailto:shaun@shaunoneill.com" className="text-primary hover:underline">shaun@shaunoneill.com</a>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Information we collect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p><strong>Account information:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your email address, name and profile picture, from the Google account you sign in with</li>
              <li>Your sign-in sessions: when each started and the browser it is in (not your IP address), kept for up to 30 days</li>
              <li>Settings you choose, such as your currency and default household</li>
            </ul>

            <p><strong>Receipt data:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Receipt images you upload, from the website or the Chrome extension, or forward to your forwarding address</li>
              <li>What is read off them: merchant, items, prices, dates, payment method, and any loyalty or VAT numbers printed on the receipt</li>
              <li>Categories, business-expense flags and notes you add</li>
              <li>Recurring subscriptions you choose to track</li>
            </ul>

            <p><strong>Bills and your monthly plan:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>The income, bills, one-off amounts and savings goals you add, and whether each has been paid</li>
              <li>Bank balances, but only ones you type in yourself. ReceiptWise does not connect to your bank</li>
              <li>Bills and statements you upload or forward to your forwarding address, and what is read off them: who they are from, amounts, dates, billing periods, and the last four characters of an account or card number</li>
              <li>For forwarded email: the sender, the subject and the attachments. The rest of the message is read only when it has no attachment, to find the bill in it</li>
            </ul>

            <p><strong>The ReceiptWise Clipper extension for Chrome:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>It sees a page only when you start a clip on it, by clicking its icon or pressing its shortcut, and it sends us only the area you select, as an image</li>
              <li>It does not read or send your browsing history, the addresses of pages you visit, or anything else on the page</li>
              <li>It keeps its key, and the email address of the account it is connected to, in Chrome&apos;s storage for extensions. Chrome copies the key to your other browsers if you use Chrome sync. You can revoke it in Settings → Integrations</li>
            </ul>

            <p><strong>The ReceiptWise app for iPhone and Android:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>The photos you take or choose, and the files you open in it, are uploaded like ones added on the website. It uses the camera only while you scan, and sees only the photos you pick, not your library</li>
              <li>On your phone it keeps your sign-in session (in the phone&apos;s secure storage), uploads still waiting for a connection, and a copy of recent figures so it opens quickly. Signing out deletes them</li>
              <li>When the app hits an error, it sends us the error&apos;s message and technical details, the screen it was on, the app&apos;s version and your account ID, never what was on the screen. These go to our application logs (section 5)</li>
              <li>If you turn on notifications: a push token for your phone, its type, the app&apos;s version, its language and your time zone, so notifications arrive at a sensible hour</li>
              <li>App lock&apos;s Face ID, Touch ID or fingerprint check happens on your phone. We never receive it</li>
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
          <CardContent className="space-y-3 text-sm leading-relaxed">
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
            <CardTitle>4. How receipts and bills are read</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Receipts and bills are read by AI models, reached through Vercel&apos;s AI Gateway. Receipt images,
              and bills and statements you upload or forward (PDFs, photos, or an email&apos;s text when it has no
              attachment), are sent to <strong>Google&apos;s Gemini</strong> models to extract the merchant,
              items and totals, or the provider, the amount due and the due date. Summarised spending figures
              (totals by category and shop, never the receipts themselves) are sent the same way to write your
              spending summaries. If Google&apos;s models are unavailable, the same request goes to{' '}
              <strong>OpenAI</strong> instead.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Requests only go to providers that have agreed with Vercel to keep nothing (zero data retention) and that do not train models on what they are sent</li>
              <li>We store what comes back in our own database</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Who processes your data for us</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>We use these service providers to run ReceiptWise. They process data on our behalf and only for these purposes:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Google</strong> — you sign in with your Google account; Google tells us your name, email address and profile picture, and knows that you signed in to ReceiptWise</li>
              <li><strong>Stripe</strong> — subscriptions and payments</li>
              <li><strong>Google</strong> (Gemini) — reading receipts and bills, and writing spending summaries (see section 4)</li>
              <li><strong>OpenAI</strong> — the same, only when Google&apos;s models are unavailable</li>
              <li><strong>Vercel</strong> — hosting, storage of receipt images and of bills (Vercel Blob; bills in a private store), the AI Gateway that passes requests to the two providers above, and cookieless page-view statistics (Vercel Analytics)</li>
              <li><strong>Expo</strong> — delivers the app&apos;s updates, and passes its notifications (their text and your phone&apos;s push token) to Apple or Google to show on your phone</li>
              <li><strong>Migadu</strong> — the support@receiptwise.io mailbox</li>
              <li><strong>Cloudflare</strong> — receives email sent to your forwarding address and passes it to us</li>
              <li><strong>Neon</strong> — our Postgres database, hosted in the London (eu-west-2) region</li>
              <li><strong>PostHog</strong> (EU cloud) — product analytics and session recordings, only if you accept analytics; your email address is attached to your analytics profile so we can answer support questions about it</li>
              <li><strong>Rapid7 InsightOps</strong> (EU region) — application logs. Logs identify you by an internal account ID (email addresses are removed before logs are sent) and can include the contents of receipts being processed. The contents of bills, balances and income are not logged. Logs are used only to diagnose faults and abuse</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>6. International transfers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Some of these providers are based in the United States or process data there (for example Google,
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
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <ul className="list-disc pl-5 space-y-1">
              <li>Data is encrypted in transit (TLS) and at rest by our hosting and database providers</li>
              <li>Receipt images are stored at long, unguessable addresses; anyone holding an image&apos;s address can open it, so treat shared links with care</li>
              <li>Bills are stored privately: they can only be opened through the app, by you and anyone you share them with</li>
              <li>Your forwarding address is the only thing that identifies you on forwarded email; you can replace it in Settings at any time, and mail to the old one is then refused</li>
              <li>You sign in with Google, so ReceiptWise holds no password for you; payments are handled by Stripe, which is PCI DSS certified</li>
              <li>Access to production data is restricted to the operator of the service</li>
            </ul>
            <p>No method of transmission or storage is completely secure, and we cannot guarantee absolute security.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>8. Household sharing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>When you create or join a household:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Receipts assigned to the household are visible to every member, including images and extracted details</li>
              <li>Bills, income, savings goals and balances you share with the household are visible to every member, who can also mark them paid; only you can change or delete what you added</li>
              <li>The household owner can remove members</li>
              <li>You can leave a household, or move your receipts out of it, at any time</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>9. How long we keep it</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Receipts you delete</strong> disappear from the app immediately, and are purged — image included — within 30 days</li>
              <li><strong>Bills you delete</strong> are purged, file included, within 30 days. A <strong>forwarded email</strong> itself is deleted 7 days after it has been read, and our record of it (sender, subject, what happened) after 90 days</li>
              <li><strong>Deleting your account</strong> takes effect 24 hours after you ask (so an accidental request can be undone). We then cancel your subscription and delete your account and everything in it: receipts and their images, bills and their files, your plan, and forwarded emails. A household you own passes to its longest-standing other member, or is deleted if you were its only member</li>
              <li><strong>Invoices</strong> are kept by Stripe for as long as tax law requires</li>
              <li><strong>Application logs, analytics and session recordings</strong> are deleted automatically on our providers&apos; retention schedules, and are not used to rebuild anything you have deleted</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>10. Your rights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
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
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Essential — always on.</strong> A session cookie keeps you signed in. The service cannot work without them, so they do not need consent.</li>
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
          <CardContent className="space-y-3 text-sm leading-relaxed">
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
          <CardContent className="space-y-3 text-sm leading-relaxed">
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
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Questions about this policy or your data: <a href="mailto:support@receiptwise.io" className="text-primary hover:underline">support@receiptwise.io</a>.
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
