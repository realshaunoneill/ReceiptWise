import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Privacy Policy - ReceiptWise',
  description: 'What ReceiptWise collects, why, who processes it for us, how long we keep it, and your rights.',
  path: '/privacy',
});

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
