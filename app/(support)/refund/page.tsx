'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Navigation } from '@/components/layout/navigation';
import { Mail, ExternalLink, CreditCard, Clock, AlertCircle, HelpCircle, RefreshCcw, XCircle } from 'lucide-react';
import Link from 'next/link';

export default function RefundPage() {
  return (
    <>
      <Navigation />
      <main className="container mx-auto max-w-4xl space-y-6 p-4 sm:p-6" aria-labelledby="refund-title">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 id="refund-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Refund Policy</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-2">
              Learn about our refund process and subscription management
            </p>
          </div>
          <Link
            href="/support"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            <span>Support Center</span>
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Refund Policy Card */}
          <Card className="relative overflow-hidden">
            <CardHeader>
              <CardTitle>Our Refund Policy</CardTitle>
              <CardDescription>What you need to know about refunds</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-primary/10 mt-1 shrink-0">
                    <RefreshCcw className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-medium">Pro-Rated Refunds</h3>
                    <p className="text-sm text-muted-foreground">
                      We offer pro-rated refunds for unused subscription time within 7 days of purchase or renewal.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-primary/10 mt-1 shrink-0">
                    <AlertCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-medium">Technical Issues</h3>
                    <p className="text-sm text-muted-foreground">
                      If you experience technical issues that prevent service usage, we'll work with you to resolve it or provide a refund.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-primary/10 mt-1 shrink-0">
                    <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-medium">Processing Time</h3>
                    <p className="text-sm text-muted-foreground">
                      Refund requests are typically processed within 5-7 business days through Stripe.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-primary/10 mt-1 shrink-0">
                    <XCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-medium">Cancellation Anytime</h3>
                    <p className="text-sm text-muted-foreground">
                      You can cancel your subscription anytime through the billing portal. No refund needed.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Management Card */}
          <Card className="relative overflow-hidden">
            <CardHeader>
              <CardTitle>Manage Your Subscription</CardTitle>
              <CardDescription>Cancel or modify your subscription easily</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <h3 className="font-medium">Self-Service Portal</h3>
                <p className="text-sm text-muted-foreground">
                  You can manage your subscription directly through our billing portal:
                </p>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span>Cancel or pause your subscription</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span>Update payment method</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span>View billing history and invoices</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span>Change billing information</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/settings"
                className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="p-2 rounded-full bg-primary/20">
                  <CreditCard className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium group-hover:text-primary transition-colors">Go to Settings</p>
                  <p className="text-sm text-muted-foreground">Access your billing portal</p>
                </div>
                <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
              </Link>

              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> When you cancel, you'll retain access to premium features until the end of your current billing period.
                </p>
              </div>

              <div className="absolute -z-10 left-0 bottom-0 top-1/2 right-1/2 bg-linear-to-bl from-primary/5 via-primary/5 to-transparent blur-3xl" />
            </CardContent>
          </Card>
        </div>

        {/* Request Refund Card */}
        <Card>
          <CardHeader>
            <CardTitle>Request a Refund</CardTitle>
            <CardDescription>If you need to request a refund, here's how</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href="mailto:support@receiptwise.io?subject=Refund%20Request"
                className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="p-2 rounded-full bg-primary/10 shrink-0">
                  <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium transition-colors group-hover:text-primary">Email Support</p>
                  <p className="text-sm text-muted-foreground truncate">support@receiptwise.io</p>
                </div>
                <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
              </a>

              <Link
                href="/support"
                className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="p-2 rounded-full bg-primary/20 shrink-0">
                  <HelpCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium group-hover:text-primary transition-colors">Support Center</p>
                  <p className="text-sm text-muted-foreground">More contact options</p>
                </div>
                <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-2">What to Include in Your Request</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Your account email address</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Subscription start date (if known)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Reason for refund request</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Any relevant details or issues experienced</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Additional Information */}
        <Card>
          <CardHeader>
            <CardTitle>Important Information</CardTitle>
            <CardDescription>Additional details about our refund process</CardDescription>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <div className="space-y-4">
              <p>
                We strive to make our refund process as simple and fair as possible. Here are some additional details
                about our policy:
              </p>
              <ul className="list-disc pl-4 space-y-2">
                <li>
                  <strong>7-Day Window:</strong> Refund requests must be submitted within 7 days of subscription
                  purchase or renewal. Refunds will be pro-rated based on the unused portion of your subscription.
                </li>
                <li>
                  <strong>Cancellation vs Refund:</strong> You can cancel your subscription at any time without
                  requesting a refund. When you cancel, you'll continue to have access until your billing period ends.
                </li>
                <li>
                  <strong>Technical Issues:</strong> If you experience problems preventing you from using the service,
                  contact us immediately. We'll work to resolve the issue or process a refund if necessary.
                </li>
                <li>
                  <strong>Processing Time:</strong> Approved refunds are processed within 5-7 business days through
                  Stripe. The time for the refund to appear in your account depends on your bank or card issuer.
                </li>
                <li>
                  <strong>Refund Method:</strong> Refunds are issued to the original payment method used for the
                  subscription purchase.
                </li>
              </ul>
              <p className="text-sm text-muted-foreground mt-4">
                For any questions about our refund policy, please contact us at{' '}
                <a href="mailto:support@receiptwise.io" className="text-primary hover:underline">
                  support@receiptwise.io
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
