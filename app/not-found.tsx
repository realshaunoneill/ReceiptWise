import type { Metadata } from 'next';
import { NotFoundContent } from '@/components/layout/not-found-content';

// A server file so the page can have its own title; a <title> rendered from the client component
// was replaced by the root layout's.
export const metadata: Metadata = {
  title: 'Page not found - ReceiptWise',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return <NotFoundContent />;
}
