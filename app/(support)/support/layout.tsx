import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Support - ReceiptWise',
  description: 'Get help with ReceiptWise: signing in, sharing with your household, receipts, bills and your account.',
  path: '/support',
});

export default function SupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
