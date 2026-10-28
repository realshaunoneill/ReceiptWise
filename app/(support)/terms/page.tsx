'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Navigation } from '@/components/layout/navigation';

// Same derivation as createCheckoutSession in lib/stripe.ts, so the terms never describe a trial
// that checkout would not grant.
const TRIAL_DAYS = process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS
  ? parseInt(process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS, 10)
  : 0;
const HAS_TRIAL = TRIAL_DAYS > 0 && !Number.isNaN(TRIAL_DAYS);

export default function TermsPage() {
  return (
    <>
      <Navigation />
      <main className="container mx-auto max-w-4xl space-y-6 p-4 sm:p-6 pb-12" aria-labelledby="terms-title">
        <div>
          <h1 id="terms-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Terms of Service</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:mt-2">
            Last updated: 24 October 2026
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Acceptance of Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              By accessing and using ReceiptWise ("the Service"), you accept and agree to be bound by the terms and
              provision of this agreement. If you do not agree to these terms, please do not use the Service.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Description of Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              ReceiptWise provides receipt management and expense tracking services, including AI-powered OCR
              (Optical Character Recognition) for extracting data from receipt images, spending analytics,
              household sharing features, and a monthly plan of your income, bills and savings, with bills read
              from documents you upload or forward by email.
            </p>
            <p>
              <strong>The plan is an estimate, not financial advice.</strong> It is worked out from what you enter
              and from what is read off your bills, which can be incomplete or wrong. Check amounts and dates
              against your bills and your bank, and don&apos;t rely on it to decide whether a payment will go through.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. User Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              You sign in with your Google account, so keep that account secure. You are responsible for all
              activity under your ReceiptWise account.
            </p>
            <p>
              You must provide accurate and complete information when creating your account and keep this
              information up to date.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Subscription and Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              <strong>One plan:</strong> ReceiptWise has a single paid plan, Premium, billed monthly or annually at
              the price shown on the pricing page when you subscribe. There is no free tier. Prices include any
              VAT that applies.
            </p>
            {HAS_TRIAL && (
              <p>
                <strong>Free trial:</strong> New subscribers get a {TRIAL_DAYS}-day free trial. Card details are
                needed to start it. If you do not cancel before the trial ends, your subscription continues
                automatically and you are charged the monthly or annual price you chose. The trial is available
                once per customer.
              </p>
            )}
            <p>
              <strong>Renewal:</strong> Subscriptions renew automatically at the end of each billing period until
              you cancel.
            </p>
            <p>
              <strong>Payment Processing:</strong> All payments are processed securely through Stripe. We do not
              store your credit card information.
            </p>
            <p>
              <strong>Cancellation:</strong> You may cancel at any time through the billing portal in Settings.
              Cancellation takes effect at the end of the current billing period (or the trial), and you keep access
              until then.
            </p>
            <p>
              <strong>Refunds and your right to withdraw:</strong> see our{' '}
              <a href="/refund" className="text-primary hover:underline">Refund Policy</a>, which includes the
              14-day right of withdrawal that consumers in the EU and UK have.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. User Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              You retain all rights to the content you upload to the Service, including receipt images and associated
              data. By uploading content, you grant us a license to process, store, and display this content solely
              for the purpose of providing the Service to you.
            </p>
            <p>
              You are responsible for ensuring you have the right to upload any content to the Service and that such
              content does not violate any laws or third-party rights.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>6. Acceptable Use</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use the Service for any illegal purpose or in violation of any laws</li>
              <li>Upload malicious code, viruses, or any harmful content</li>
              <li>Attempt to gain unauthorized access to the Service or other users' accounts</li>
              <li>Use automated systems to access the Service without our permission</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Impersonate any person or entity</li>
              <li>Upload in bulk or by script beyond normal personal and household use; receipt processing is rate-limited to keep the service available to everyone</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>7. Reading receipts and bills</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              The Service uses AI to read receipts, and bills and statements you upload or forward: the merchant,
              items and totals, or the provider, amount due and due date. We cannot guarantee that what is read is
              always accurate. Check it, particularly amounts and dates before relying on them in your plan.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>8. Data Privacy and Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              We take data privacy and security seriously. Please review our Privacy Policy to understand how we
              collect, use, and protect your personal information.
            </p>
            <p>
              While we implement industry-standard security measures, no method of transmission or storage is 100%
              secure. You use the Service at your own risk.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>9. Household Sharing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              Premium users may create households and invite other people to share receipts, and bills, income,
              goals and plan items they choose to share. By creating or joining a household, you agree that other
              members can see what is shared with it.
            </p>
            <p>
              The household owner is responsible for who they invite, and can remove members.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>10. Intellectual Property</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              The Service and its original content, features, and functionality are owned by ReceiptWise and are
              protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>11. Disclaimer of Warranties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              The Service is provided "as is" and "as available" without any warranties of any kind, either express
              or implied. We do not warrant that the Service will be uninterrupted, secure, or error-free.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>12. Limitation of Liability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              To the fullest extent permitted by law, ReceiptWise shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred
              directly or indirectly, or any loss of data, use, goodwill, or other intangible losses.
            </p>
            <p>
              Nothing in these Terms excludes or limits liability that cannot be excluded or limited by law, or
              affects your statutory rights as a consumer.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>13. Termination</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              We may terminate or suspend your account and access to the Service immediately, without prior notice,
              for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
              If we close your account for any other reason, we will give you reasonable notice where we can and
              refund any unused part of a period you have paid for.
            </p>
            <p>
              Upon termination, your right to use the Service will immediately cease. You may delete your account
              at any time through your account settings.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>14. Changes to Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              We may modify these terms. If we make material changes, we will show a notice in the Service before
              they take effect. If you do not agree to the changes, you can cancel before they apply; continuing to
              use the Service after that means you accept them.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>15. Governing Law</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              These Terms are governed by the laws of Ireland, and the Irish courts have jurisdiction. If you are a
              consumer living elsewhere in the EU or in the UK, you also keep the protection of the mandatory
              consumer laws of your country, and you can bring proceedings in your local courts.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>16. Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p>
              If you have any questions about these Terms, please contact us at:
            </p>
            <p>
              Email: <a href="mailto:support@receiptwise.io" className="text-primary hover:underline">support@receiptwise.io</a>
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
