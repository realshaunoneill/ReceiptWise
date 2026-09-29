import type React from 'react';
import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { ClerkProvider } from '@clerk/nextjs';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { Footer } from '@/components/layout/footer';
import { StagingBanner } from '@/components/layout/staging-banner';
import { ConsentBanner } from '@/components/layout/consent-banner';
import { QueryProvider } from '@/lib/providers/query-provider';
import { PostHogProvider } from '@/lib/providers/posthog-provider';
import { Toaster } from 'sonner';
import { getAppUrl } from '@/lib/app-url';
import './globals.css';

/*
 * IBM Plex, not Inter.
 *
 * Inter is the default sans of every generated dashboard, and a receipt tracker
 * that looks generated is a receipt tracker people don't trust with their bank
 * statements. Plex Sans has actual voice in its letterforms and, more usefully,
 * ships true tabular figures — which matters when the whole product is columns
 * of money. Plex Mono carries receipt numbers, API keys and IDs, and echoes the
 * thermal-printer type of the paper receipts being scanned.
 */
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ReceiptWise - Family Expense & Receipt Tracker',
  description: 'Share expenses with family, roommates, or partners. AI-powered receipt scanning and household collaboration in one place',
  applicationName: 'ReceiptWise',
  keywords: ['receipt tracker', 'expense tracker', 'family expenses', 'household sharing', 'receipt scanner', 'spending tracker', 'subscription manager', 'shared expenses', 'roommate expenses'],
  authors: [{ name: 'ReceiptWise' }],
  creator: 'ReceiptWise',
  publisher: 'ReceiptWise',
  metadataBase: new URL(getAppUrl()),
  // No root alternates.canonical: a canonical set here is inherited by every page that does not
  // override it, so /sign-in and every app page declared the homepage as their canonical. Each
  // public page sets its own instead.
  openGraph: {
    title: 'ReceiptWise - Family Expense & Receipt Tracker',
    description: 'Share expenses with family, roommates, or partners. AI-powered receipt scanning and household collaboration in one place',
    url: '/',
    siteName: 'ReceiptWise',
    images: [
      {
        // JPEG at 1200x800 (~115 KB). The PNG was 1.7 MB, over the size some
        // link-preview crawlers will fetch.
        url: '/opengraph.jpg',
        width: 1200,
        height: 800,
        alt: 'ReceiptWise - Receipt & Expense Tracker',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ReceiptWise - Family Expense & Receipt Tracker',
    description: 'Share expenses with family, roommates, or partners. AI-powered receipt scanning and household collaboration in one place',
    images: ['/opengraph.jpg'],
    creator: '@receiptwise',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
      <html lang="en" suppressHydrationWarning>
        <body className={`${plexSans.variable} ${plexMono.variable} font-sans antialiased`}>
          <NuqsAdapter>
            <QueryProvider>
              <PostHogProvider>
                <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                  <StagingBanner />
                  <div className="flex min-h-screen flex-col">
                    <div className="flex-1">{children}</div>
                    <Footer />
                  </div>
                  <Toaster />
                  <ConsentBanner />
                </ThemeProvider>
              </PostHogProvider>
            </QueryProvider>
          </NuqsAdapter>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
