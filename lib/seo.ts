import type { Metadata } from 'next';

/**
 * Shared page metadata. Next merges metadata one top-level key at a time, so a page that set only
 * openGraph.title replaced the whole inherited openGraph block: its share preview lost the image,
 * URL and site name, and Twitter kept showing the homepage's title. Each public page builds its
 * full set here instead.
 */

export const SITE_NAME = 'ReceiptWise';
export const SITE_TITLE = 'ReceiptWise - Family Expense & Receipt Tracker';
export const SITE_DESCRIPTION =
  'Share expenses with family, housemates or a partner. Receipts read for you by AI, and one place for the whole household.';

export const OG_IMAGE = {
  url: '/opengraph.jpg',
  width: 1200,
  height: 630,
  alt: 'ReceiptWise: receipts read for you, shared with your household',
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
