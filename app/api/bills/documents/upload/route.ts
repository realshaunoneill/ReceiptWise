import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse, type NextRequest } from 'next/server';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute } from '@/lib/route-guards';
import { BILL_MIME_TYPES, billsPrefix, isOwnBillPath, isPrivateStoreConfigured, MAX_BILL_BYTES, readWriteToken } from '@/lib/storage/private-blob';

export const runtime = 'nodejs';

// POST /api/bills/documents/upload - Client upload tokens for bills, into the private store, only
// under the user's own prefix (lib/storage/private-blob.ts).
export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = await guardFinanceRoute(req, { mutating: true, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId } = guard;

  if (!isPrivateStoreConfigured()) {
    return NextResponse.json({ error: 'Bill uploads are not set up yet' }, { status: 503 });
  }

  try {
    const body = (await req.json()) as HandleUploadBody;
    const jsonResponse = await handleUpload({
      body,
      request: req,
      token: readWriteToken(),
      onBeforeGenerateToken: async (pathname) => {
        if (!isOwnBillPath(pathname, user.id)) throw new Error('Invalid pathname');
        return {
          allowedContentTypes: [...BILL_MIME_TYPES],
          maximumSizeInBytes: MAX_BILL_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    submitLogEvent('bill-document', `Bill upload token failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { userId: user.id }, true);
    return NextResponse.json({ error: 'Failed to start the upload' }, { status: 400 });
  }
}

// GET /api/bills/documents/upload - The pathname prefix this user's uploads must use
export async function GET(req: NextRequest): Promise<NextResponse> {
  const guard = await guardFinanceRoute(req, { mutating: false, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  return NextResponse.json(
    { prefix: billsPrefix(guard.user.id), configured: isPrivateStoreConfigured() },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
