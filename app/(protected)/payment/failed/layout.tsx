import type { Metadata } from 'next';

// The page is a client component, which can't export metadata; without this every app page was
// titled the same as the homepage.
export const metadata: Metadata = { title: 'Payment not completed - ReceiptWise' };

export default function PaymentFailedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
