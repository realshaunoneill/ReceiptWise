import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUser, requireSubscription, requireNoPendingDeletion } from '@/lib/auth-helpers';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { sanitizeErrorMessage } from '@/lib/errors';
import { randomUUID } from 'crypto';
import { receiptsBlobToken } from '@/lib/storage/receipt-blob';

// Route configuration
export const runtime = 'nodejs';
export const maxDuration = 60; // Increased for OpenAI processing

const ENV_PATH_PREFIX =
  process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
const MAX_UPLOAD_SIZE_MB = parseInt(
  process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || '15',
);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = (request.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user, clerkId } = authResult;

    // Check subscription for receipt upload
    const subCheck = await requireSubscription(user);
    if (subCheck) return subCheck;

    const deletionCheck = requireNoPendingDeletion(user);
    if (deletionCheck) return deletionCheck;

    const body = (await request.json()) as HandleUploadBody;

    submitLogEvent('receipt-upload', 'Starting receipt upload', correlationId, { userId: user.id, clerkId });

    const jsonResponse = await handleUpload({
      body,
      request,
      token: receiptsBlobToken(),
      onBeforeGenerateToken: async (
        pathname: string,
        clientPayload: string | null,
      ) => {
        if (!pathname.startsWith(`${ENV_PATH_PREFIX}/receipts/`)) {
          throw new Error('Invalid pathname');
        }

        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp'],
          maximumSizeInBytes: MAX_UPLOAD_SIZE_MB * 1024 * 1024,
          tokenPayload: JSON.stringify({
            userId: user.id,
            clerkId,
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
      clerkId,
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
