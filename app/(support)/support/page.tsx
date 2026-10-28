'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navigation } from '@/components/layout/navigation';
import { Mail, ExternalLink, MessageCircle, ArrowRight, FileText } from 'lucide-react';
import Link from 'next/link';
import { BILLS_LAUNCHED } from '@/lib/public-features';

// The questions people actually ask. Answers say where in the app to go, not how the app works.
const QUESTIONS = [
  {
    q: 'How do I sign in?',
    a: 'With your Google account: the same button signs you in and, the first time, creates your account. There is no ReceiptWise password. No Google account? Email us.',
  },
  {
    q: 'How do I add receipts?',
    a: 'On the Receipts page, drag photos in, pick files, or take a photo on your phone. JPG, PNG and WebP all work, several at once.',
  },
  {
    q: 'How do I share with my household?',
    a: 'On the Sharing page, create a household and copy the invitation link for each person. They sign in with Google and accept it.',
  },
  ...(BILLS_LAUNCHED
    ? [{
      q: 'How do I forward bills by email?',
      a: 'Settings → Integrations has your own forwarding address. Forward a bill to it, or set up a rule in your email to do it for you; it appears in Bills to file, on your Plan.',
    }]
    : []),
  {
    q: 'How do I manage or cancel my subscription?',
    a: 'Settings → Subscription opens the billing portal, where you can change plan, update your card or cancel. Payment is by card, through Stripe.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Settings → Data. Deletion happens 24 hours later, so an accidental request can be undone; export your data first if you want a copy.',
  },
];

export default function SupportPage() {
  return (
    <>
      <Navigation />
      <main className="container mx-auto max-w-4xl space-y-6 p-4 sm:p-6" aria-labelledby="support-title">
        <div>
          <h1 id="support-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Support Center</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:mt-2">
            Get help with ReceiptWise or reach out to our team
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Contact Options */}
          <Card className="relative overflow-hidden">
            <CardHeader>
              <CardTitle>Contact Options</CardTitle>
              <CardDescription>Choose how you'd like to get support</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <a
                href="mailto:support@receiptwise.io"
                className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="p-2 rounded-full bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium transition-colors group-hover:text-primary">Email Support</p>
                  <p className="text-sm text-muted-foreground truncate">support@receiptwise.io</p>
                </div>
                <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
              </a>

              <a
                href="mailto:support@receiptwise.io?subject=Bug%20or%20idea"
                className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="p-2 rounded-full bg-primary/10">
                  <MessageCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium transition-colors group-hover:text-primary">
                    Bugs and ideas
                  </p>
                  <p className="text-sm text-muted-foreground">Tell us what broke, or what you&apos;d like</p>
                </div>
                <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
              </a>
            </CardContent>
          </Card>

          {/* Quick Help */}
          <Card className="relative overflow-hidden">
            <CardHeader>
              <CardTitle>Quick Help</CardTitle>
              <CardDescription>Common questions and answers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <dl className="space-y-3">
                  {QUESTIONS.map(({ q, a }) => (
                    <div key={q} className="space-y-1">
                      <dt className="text-sm font-medium">{q}</dt>
                      <dd className="text-sm text-muted-foreground">{a}</dd>
                    </div>
                  ))}
                </dl>

                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Not here? Email us and a person will answer.
                </p>
              </div>
              <div className="absolute -z-10 left-0 bottom-0 top-1/2 right-1/2 bg-linear-to-bl from-primary/5 via-primary/5 to-transparent blur-3xl" />
            </CardContent>
          </Card>
        </div>

        {/* Support Resources */}
        <Card>
          <CardHeader>
            <CardTitle>Support Resources</CardTitle>
            <CardDescription>Helpful documents and policies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href="/terms" className="p-4 border rounded-lg hover:bg-muted/50 transition-colors group">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium group-hover:text-primary transition-colors">Terms of Service</p>
                    <p className="text-sm text-muted-foreground mt-1">Review our terms and conditions</p>
                  </div>
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
                </div>
              </Link>

              <Link href="/privacy" className="p-4 border rounded-lg hover:bg-muted/50 transition-colors group">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium group-hover:text-primary transition-colors">Privacy Policy</p>
                    <p className="text-sm text-muted-foreground mt-1">How we handle and protect your data</p>
                  </div>
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
                </div>
              </Link>

              <Link href="/refund" className="p-4 border rounded-lg hover:bg-muted/50 transition-colors group">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium group-hover:text-primary transition-colors">Refund Policy</p>
                    <p className="text-sm text-muted-foreground mt-1">Learn about our refund process</p>
                  </div>
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
                </div>
              </Link>

              <Link href="/settings" className="p-4 border rounded-lg hover:bg-muted/50 transition-colors group">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium group-hover:text-primary transition-colors">Account Settings</p>
                    <p className="text-sm text-muted-foreground mt-1">Manage your subscription and preferences</p>
                  </div>
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
                </div>
              </Link>

              <a
                href="mailto:support@receiptwise.io?subject=Account%20Help"
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium group-hover:text-primary transition-colors">Account Help</p>
                    <p className="text-sm text-muted-foreground mt-1">Get assistance with your account</p>
                  </div>
                  <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
                </div>
              </a>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
