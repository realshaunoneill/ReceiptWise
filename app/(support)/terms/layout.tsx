import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Terms of Service - ReceiptWise',
  description: 'The terms for using ReceiptWise, the household receipt tracker.',
  path: '/terms',
});

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
