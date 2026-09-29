const PRODUCTION_URL = 'https://www.receiptwise.io';

/**
 * The absolute origin to put in links that leave the app: Stripe success/cancel/return URLs,
 * invitation links, metadataBase, and the like.
 *
 * NEXT_PUBLIC_APP_URL alone is not trustworthy — it was set to http://localhost:3000 for every
 * Vercel environment, which put localhost into the live canonical/OG tags, the billing portal's
 * "Return to ReceiptWise" button and the extension's processing trigger. So production is pinned
 * to the real domain, previews use the deployment's own URL, and the env var is only honoured
 * when it is not localhost or when running locally.
 */
export function getAppUrl(): string {
  if (process.env.VERCEL_ENV === 'production') {
    return PRODUCTION_URL;
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const isLocalhost = configured ? /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(configured) : false;

  if (configured && (!isLocalhost || !process.env.VERCEL)) {
    return configured;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return configured || PRODUCTION_URL;
}
