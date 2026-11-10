import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';

// The page is a client component, which can't export metadata; without this every app page was
// titled the same as the homepage.
export const metadata: Metadata = { title: 'Admin - ReceiptWise' };

/**
 * Admins only, decided on the server. The admin APIs check for themselves (requireAdmin), so this
 * hides nothing they'd give away; it means the page doesn't exist for anyone else either.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuthenticatedUser();
  if (auth instanceof NextResponse || !auth.user.isAdmin) notFound();
  return children;
}
