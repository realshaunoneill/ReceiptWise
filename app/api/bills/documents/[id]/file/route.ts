import { type NextRequest, NextResponse } from 'next/server';
import { guardFinanceRoute } from '@/lib/route-guards';
import { getBillDocument } from '@/lib/services/bill-document-service';
import { canReadFinanceRow } from '@/lib/services/finance-access';
import { BILL_MIME_TYPES, streamPrivate } from '@/lib/storage/private-blob';

export const runtime = 'nodejs';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/bills/documents/[id]/file - The file itself, to anyone who can see the document. Opened in
// a new tab (the app's X-Frame-Options: DENY rules out embedding a PDF).
export async function GET(req: NextRequest, { params }: RouteParams) {
  const guard = await guardFinanceRoute(req, { mutating: false, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, entitlements } = guard;
  const { id } = await params;

  const document = await getBillDocument(id);
  if (!document || !canReadFinanceRow(document, user.id, entitlements)) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  }

  const file = await streamPrivate(document.blobPathname);
  if (!file || file.statusCode !== 200) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  const contentType = (BILL_MIME_TYPES as readonly string[]).includes(document.mimeType) ? document.mimeType : 'application/octet-stream';
  const name = (document.fileName || 'bill').replace(/[^\w.\- ]/g, '_');
  return new NextResponse(file.stream, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${name}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}
