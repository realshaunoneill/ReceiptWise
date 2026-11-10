import { type NextRequest, NextResponse } from 'next/server';
import { streamPrivate } from '@/lib/storage/private-blob';
import { RECEIPT_IMAGE_TYPES } from '@/lib/storage/receipt-blob';
import { isValidReceiptImageSignature } from '@/lib/storage/receipt-image-url';

export const runtime = 'nodejs';

/**
 * GET /receipt-images/<pathname>?e=<expires>&s=<signature>: a receipt image from the private
 * store, for anyone holding a link the API signed (lib/storage/receipt-image-url.ts). Only the
 * signature and its expiry are checked, with no session and no database, so it works for <img>,
 * the app and the extension as they are, and costs the database nothing.
 *
 * Outside /api on purpose: a list of thumbnails would otherwise count against the API's
 * per-IP rate limit, and the .jpg/.png/.webp ending keeps it out of proxy.ts too.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const pathname = (await params).path.map(decodeURIComponent).join('/');
  const expires = Number(req.nextUrl.searchParams.get('e'));
  const signature = req.nextUrl.searchParams.get('s') ?? '';
  const now = Math.floor(Date.now() / 1000);

  const extension = pathname.split('.').pop()?.toLowerCase() ?? '';
  const contentType = Object.entries(RECEIPT_IMAGE_TYPES).find(([, ext]) => ext === extension)?.[0];
  if (!contentType || !pathname.includes('/receipts/') || pathname.includes('..')) {
    return new NextResponse('Not found', { status: 404 });
  }
  if (!isValidReceiptImageSignature(pathname, expires, signature)) {
    return new NextResponse('Not found', { status: 404 });
  }
  if (expires < now) {
    // The page that had this link is old: reloading it gets a fresh one.
    return new NextResponse('This link has expired. Reload the page.', { status: 410 });
  }

  const file = await streamPrivate(pathname);
  if (!file) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(file.stream, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      // Private: never in a shared cache. Until the link expires, the browser needn't ask again.
      'Cache-Control': `private, max-age=${Math.max(0, Math.min(expires - now, 6 * 60 * 60))}, immutable`,
      'X-Robots-Tag': 'noindex',
    },
  });
}
