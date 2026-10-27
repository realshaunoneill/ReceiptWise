import type React from 'react';
import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { Footer } from '@/components/layout/footer';
import { StagingBanner } from '@/components/layout/staging-banner';
import { ConsentBanner } from '@/components/layout/consent-banner';
import { QueryProvider } from '@/lib/providers/query-provider';
import { PostHogProvider } from '@/lib/providers/posthog-provider';
import { HIDE_AMOUNTS_SCRIPT } from '@/lib/hide-amounts';
import { Toaster } from '@/components/ui/sonner';
import { getAppUrl } from '@/lib/app-url';
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from '@/lib/seo';
import { BILLS_LAUNCHED } from '@/lib/public-features';
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
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: ['receipt tracker', 'expense tracker', 'family expenses', 'household sharing', 'receipt scanner', 'spending tracker', 'subscription tracker', ...(BILLS_LAUNCHED ? ['bills tracker', 'monthly budget'] : []), 'shared expenses', 'housemate expenses'],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  metadataBase: new URL(getAppUrl()),
  // No root alternates.canonical: a canonical set here is inherited by every page that does not
  // override it, so /sign-in and every app page declared the homepage as their canonical. Each
  // public page sets its own instead (lib/seo.ts).
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: '/',
    siteName: SITE_NAME,
    images: [OG_IMAGE],
    locale: 'en_IE',
    type: 'website',
  },
  // No twitter `creator`: it named @receiptwise, an account that doesn't exist.
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
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
  // No `icons`: app/favicon.ico, app/icon.png and app/apple-icon.png already emit those links, and
  // listing them here as well declared every icon twice.
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Hide amounts before the first paint, so the figures never flash. */}
        <script dangerouslySetInnerHTML={{ __html: HIDE_AMOUNTS_SCRIPT }} />
      </head>
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
  );
}
