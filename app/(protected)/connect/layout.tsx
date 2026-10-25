import type { Metadata } from 'next';

// The page is a client component, which can't export metadata.
export const metadata: Metadata = { title: 'Connect the extension - ReceiptWise', robots: { index: false, follow: false } };

export default function ConnectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
