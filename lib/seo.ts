import type { Metadata } from 'next';
import { BILLS_LAUNCHED } from '@/lib/public-features';

/**
 * Shared page metadata. Next merges metadata one top-level key at a time, so a page that set only
 * openGraph.title replaced the whole inherited openGraph block: its share preview lost the image,
 * URL and site name, and Twitter kept showing the homepage's title. Each public page builds its
 * full set here instead.
 */

export const SITE_NAME = 'ReceiptWise';
// The plan leads (2026-10-29): it is what people use, and "see where it went" is free in every
// bank app. Receipts and bills are how the plan fills itself in.
export const SITE_TITLE = BILLS_LAUNCHED
  ? 'ReceiptWise - Budget planner, bills and receipts, payday to payday'
  : 'ReceiptWise - Family Expense & Receipt Tracker';
export const SITE_DESCRIPTION = BILLS_LAUNCHED
  ? 'Know what\'s left until payday. Your pay, your bills and your spending in one plan you can share with your household, with receipts and bills read for you. Nothing connects to your bank.'
  : 'Share expenses with family or a partner. Receipts read for you by AI, and one place for the whole household.';

export const OG_IMAGE = {
  url: '/opengraph.jpg',
  width: 1200,
  height: 630,
  alt: BILLS_LAUNCHED
    ? 'ReceiptWise: know what\'s left until payday, with your pay, bills and receipts in one plan'
    : 'ReceiptWise: receipts read for you, shared with your household',
};

export function pageMetadata({
  title,
  description,
  path,
  index = true,
}: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: SITE_NAME, type: 'website', locale: 'en_IE', images: [OG_IMAGE] },
    twitter: { card: 'summary_large_image', title, description, images: [OG_IMAGE.url] },
    ...(index ? {} : { robots: { index: false, follow: true } }),
  };
}
