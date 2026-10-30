'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Navigation } from '@/components/layout/navigation';

// High level on purpose (Shaun, 2026-10-29): kinds of data and kinds of company, not product names,
// regions, field lists or how the service is built. app/(support)/legal-pages.test.ts fails if a
// supplier's name comes back. A new feature needs no change here unless it adds a new kind of data,
// a new kind of company that receives it, or a new place it's stored.
export default function PrivacyPage() {
  return (
    <>
      <Navigation />
      <main className="container mx-auto max-w-4xl space-y-6 p-4 sm:p-6 pb-12" aria-labelledby="privacy-title">
        <div>
          <h1 id="privacy-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Privacy policy</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:mt-2">
            Last updated: 30 October 2026
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Who we are</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              ReceiptWise (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is a receipt, bills and household
              budgeting service run by Shaun O&apos;Neill in Ireland, who is the controller of the personal data
              described in this policy. For anything about your data, contact{' '}
              <a href="mailto:support@receiptwise.io" className="text-primary hover:underline">support@receiptwise.io</a>,
              or Shaun directly at{' '}
              <a href="mailto:shaun@shaunoneill.com" className="text-primary hover:underline">shaun@shaunoneill.com</a>.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. What we collect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p><strong>Your account:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your name, email address and profile picture, from the Google account you sign in with</li>
              <li>Your sign-in sessions, kept for up to 30 days</li>
              <li>Settings you choose, such as your currency and where new receipts go</li>
              <li>How you found ReceiptWise, saved once when your account is made: the website that sent you, or the campaign named in the link you followed, or that you signed up in the app</li>
            </ul>

            <p><strong>Receipts:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>The receipt photos and files you add, from the website, the app or the Chrome extension, or by forwarding them by email</li>
              <li>What is read off them, such as the shop, the items and prices, the date and how you paid, including any loyalty or VAT number printed on them</li>
              <li>Categories, notes and anything else you add to them</li>
            </ul>

            <p><strong>Bills and your monthly plan:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>The pay, bills, subscriptions, one-off amounts and savings you add, and whether each has been paid</li>
              <li>Bank balances, but only ones you type in yourself. ReceiptWise does not connect to your bank</li>
              <li>Bills and statements you add or forward, and what is read off them, such as who they are from, the amounts and dates, and the end of an account or card number</li>
              <li>For forwarded email: who sent it, its subject and its attachments. The message itself is read only when there is no attachment, to find the bill in it</li>
            </ul>

            <p><strong>The Chrome extension:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>It sees a page only when you start a clip on it, and sends us only the part you select, as an image</li>
              <li>It never reads or sends your browsing history, the pages you visit, or anything else on the page</li>
              <li>It stays connected to your account until you disconnect it, which you can do in Settings</li>
            </ul>

            <p><strong>The app for iPhone and Android:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>The photos and files you choose to add. It uses the camera only while you scan, and sees only the photos you pick, not your library</li>
              <li>So it opens quickly and works without a connection, it keeps your sign-in and a copy of recent figures on your phone. Signing out deletes them</li>
              <li>When something goes wrong, a report of the error, the screen it happened on and the app&apos;s version, linked to your account. Never what was on the screen</li>
              <li>If you turn on notifications: what&apos;s needed to send them to your phone, and your time zone, so they arrive at a sensible hour</li>
              <li>App lock&apos;s Face ID, Touch ID or fingerprint check happens on your phone. We never receive it</li>
            </ul>

            <p><strong>How ReceiptWise is used, and only if you agree:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>The pages and features used, and the kind of browser and device</li>
              <li>Recordings of how you move through the website, with everything you type and every amount hidden before it leaves your browser</li>
            </ul>

            <p><strong>Payment:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your card details go to our payment provider; we never see or store your full card number</li>
              <li>We keep a reference to your billing account, and whether your Premium is on</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. How we use it, and on what legal basis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Running the service you signed up for</strong>: storing and reading your receipts and bills, working out your plan, sharing what you choose with your household, producing insights, sending the notifications you turn on, and billing your subscription. Basis: performance of our contract with you (GDPR Art. 6(1)(b)).</li>
              <li><strong>Keeping it working and secure</strong>: error reports and logs used to find and fix faults, and to detect abuse. Basis: our legitimate interest in running a reliable, secure service (Art. 6(1)(f)).</li>
              <li><strong>Learning how ReceiptWise is used</strong>: understanding where it gets in people&apos;s way. Basis: your consent (Art. 6(1)(a)), which you can withdraw at any time from &quot;Cookie settings&quot; at the bottom of any page.</li>
              <li><strong>Legal obligations</strong>: for example keeping invoices for tax purposes. Basis: legal obligation (Art. 6(1)(c)).</li>
              <li><strong>Answering you</strong> when you contact support. Basis: legitimate interests, or our contract with you.</li>
              <li><strong>Knowing what brings people to ReceiptWise</strong>: how new accounts found us, counted together, so we spend only on what works. Basis: our legitimate interests (Art. 6(1)(f)).</li>
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
              Receipts, and the bills and statements you add or forward, are read by AI services from the AI
              companies we work with. They receive each one only to read it, keep nothing afterwards, and never
              use it to train their models. Spending summaries are written the same way from your totals by
              category and shop, never from the receipts themselves. What is read is stored in your account.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Who else handles it</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              We use other companies to run ReceiptWise. They handle your data on our behalf, and only for the
              purpose they provide:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Hosting, database and file storage</strong>: where the website, the app&apos;s server and your data are kept</li>
              <li><strong>AI companies</strong>: reading receipts and bills, and writing spending summaries (section 4)</li>
              <li><strong>Payments</strong>: subscriptions, payments and invoices</li>
              <li><strong>Email</strong>: receiving mail sent to your forwarding address, and our support mailbox</li>
              <li><strong>App delivery and notifications</strong>: the app&apos;s updates, and passing notifications to Apple or Google to show on your phone</li>
              <li><strong>Error logs</strong>: finding and fixing faults. Logs identify you by an account number, not your email address, and can include what was read off a receipt while it was being processed, but never your bills, balances or pay</li>
              <li><strong>Analytics</strong>, only if you agree: how ReceiptWise is used. Your email address is attached so we can answer support questions about it</li>
            </ul>
            <p>
              Google also knows that you signed in to ReceiptWise with your Google account. We share what you
              choose to share with the members of your household (section 8), and data with authorities only when
              the law requires it.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>6. Where it&apos;s stored, and transfers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Our database is in the United Kingdom, which the European Commission recognises as protecting data
              adequately. Some of the companies above are based in the United States or handle data there. Where
              personal data leaves the European Economic Area, the transfer is covered by the EU–US Data Privacy
              Framework where the company is certified under it, or by the European Commission&apos;s Standard
              Contractual Clauses. You can ask us which applies to any of them.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>7. Keeping it safe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <ul className="list-disc pl-5 space-y-1">
              <li>Your data is encrypted when it is sent and when it is stored</li>
              <li>Bills open only through your account, for you and anyone you share them with. Don&apos;t share a link to a receipt photo: anyone with the link can open it</li>
              <li>Your forwarding address is yours alone. You can replace it in Settings at any time, and mail to the old one is then refused</li>
              <li>You sign in with Google, so ReceiptWise holds no password for you, and card payments are handled by a provider certified to the card industry&apos;s security standard (PCI DSS)</li>
              <li>Only the person who runs ReceiptWise can reach the data behind it</li>
            </ul>
            <p>No way of sending or storing data is completely secure, and we cannot guarantee absolute security.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>8. Household sharing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>When you create or join a household:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Receipts added to the household, photos included, are visible to every member</li>
              <li>Bills, pay, savings and balances you share with the household are visible to every member, who can also mark them paid; only you can change or delete what you added</li>
              <li>The household&apos;s owner can remove members</li>
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
              <li><strong>Receipts you delete</strong> disappear from the app at once, and are deleted for good, photo included, within 30 days</li>
              <li><strong>Bills you delete</strong> are deleted for good, file included, within 30 days. A <strong>forwarded email</strong> is deleted 7 days after it has been read, and our note of it (who sent it, its subject, and what became of it) after 90 days</li>
              <li><strong>Deleting your account</strong> takes effect 24 hours after you ask, so an accidental request can be undone. We then cancel your subscription and delete your account and everything in it: receipts and their photos, bills and their files, your plan, and forwarded emails. A household you own passes to its longest-standing other member, or is deleted if you were its only member</li>
              <li><strong>Invoices</strong> are kept by our payment provider for as long as tax law requires</li>
              <li><strong>Error logs and analytics</strong> are deleted automatically after a limited time, and are never used to bring back anything you deleted</li>
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
              <li>See the personal data we hold about you</li>
              <li>Have inaccurate data corrected</li>
              <li>Have your data erased</li>
              <li>Get your data in a portable format: Settings &rarr; Data exports everything at any time</li>
              <li>Object to processing based on legitimate interests, or restrict it</li>
              <li>Withdraw your consent to analytics at any time, from &quot;Cookie settings&quot;</li>
            </ul>
            <p>
              To use any of these, use Settings or email <a href="mailto:support@receiptwise.io" className="text-primary hover:underline">support@receiptwise.io</a>. If you are unhappy with how we
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
              <li><strong>Essential, always on.</strong> A cookie keeps you signed in. The service cannot work without it, so it does not need consent.</li>
              <li><strong>Analytics, only with consent.</strong> An identifier in a cookie and in your browser&apos;s storage recognises your visits. None of it loads until you choose &quot;Accept&quot;.</li>
              <li>Your choice itself is remembered in your browser&apos;s storage.</li>
              <li>Page views are also counted without any cookie, and without identifying you.</li>
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
