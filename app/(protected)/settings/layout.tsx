import type { Metadata } from 'next';

// The page is a client component, which can't export metadata; without this every app page was
// titled the same as the homepage.
export const metadata: Metadata = { title: 'Settings - ReceiptWise' };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
