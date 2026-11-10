import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUser, requireSubscription, requireNoPendingDeletion } from '@/lib/auth-helpers';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { sanitizeErrorMessage } from '@/lib/errors';
import { randomUUID } from 'crypto';
import { receiptImagePrefix, RECEIPT_IMAGE_TYPES } from '@/lib/storage/receipt-blob';
import { isPrivateStoreConfigured, readWriteToken } from '@/lib/storage/private-blob';

// Route configuration
export const runtime = 'nodejs';
export const maxDuration = 60; // Increased for OpenAI processing

const MAX_UPLOAD_SIZE_MB = parseInt(
  process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || '15',
);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = (request.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // Check subscription for receipt upload
    const subCheck = await requireSubscription(user);
    if (subCheck) return subCheck;

    const deletionCheck = requireNoPendingDeletion(user);
    if (deletionCheck) return deletionCheck;

    const body = (await request.json()) as HandleUploadBody;

    submitLogEvent('receipt-upload', 'Starting receipt upload', correlationId, { userId: user.id });

    const jsonResponse = await handleUpload({
      body,
      request,
      // The private store: receipt images are never at a public URL (lib/storage/receipt-image-url.ts).
      token: readWriteToken(),
      onBeforeGenerateToken: async (
        pathname: string,
        clientPayload: string | null,
      ) => {
        // The user's own folder, and a random suffix, so nobody can write over or claim another
        // person's image (lib/storage/receipt-blob.ts isOwnReceiptImageUrl).
        if (!pathname.startsWith(receiptImagePrefix(user.id))) {
          throw new Error('Invalid pathname');
        }

        return {
          addRandomSuffix: true,
          allowedContentTypes: Object.keys(RECEIPT_IMAGE_TYPES),
          maximumSizeInBytes: MAX_UPLOAD_SIZE_MB * 1024 * 1024,
          tokenPayload: JSON.stringify({
            userId: user.id,
            clientPayload,
          }),
        };
      },
    });

    // Check if this is just a token generation response
    if (jsonResponse.type === 'blob.generate-client-token') {
      return NextResponse.json(jsonResponse);
    }

    // For upload completion response, we need to handle the actual upload separately
    // The client-side handleUpload completes the upload and calls this endpoint again
    // At this point, we just return the completion acknowledgment
    submitLogEvent('receipt-upload-blob-complete', 'Blob upload completed successfully', correlationId, {
      userId: user.id,
      responseType: jsonResponse.type,
      timestamp: new Date().toISOString(),
    });

    // Return success - the client will handle the actual blob URL
    return NextResponse.json(jsonResponse);
  } catch (error) {
    submitLogEvent('receipt-error', `Receipt upload error: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { error: error instanceof Error ? error.stack : undefined }, true);
    // Stack traces and raw messages stay in the logs, never in the response body.
    return NextResponse.json(
      {
        error: 'Failed to upload receipt',
        message: error instanceof Error ? sanitizeErrorMessage(error) : 'Unknown error',
      },
      { status: 400 },
    );
  }
}

// GET /api/receipt/upload - The folder this user's uploads must go to (the private store's paths
// carry the deployment's environment, which the browser doesn't know).
export async function GET(): Promise<NextResponse> {
  const authResult = await getAuthenticatedUser();
  if (authResult instanceof NextResponse) return authResult;
  return NextResponse.json(
    { prefix: receiptImagePrefix(authResult.user.id), configured: isPrivateStoreConfigured() },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
