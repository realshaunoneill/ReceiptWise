import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Refund Policy - ReceiptWise',
  description: 'Ask within 14 days of any charge for a full refund. Cancel any time from Settings.',
  path: '/refund',
});

export default function RefundLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
