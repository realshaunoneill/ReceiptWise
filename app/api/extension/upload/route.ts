import { type NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { put } from '@vercel/blob';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { receipts } from '@/lib/db/schema';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { getHouseholdMembership } from '@/lib/auth-helpers';
import { authenticateApiKey } from '@/lib/api-key-auth';
import { processReceipt } from '@/lib/receipt-processing';
import { checkReceiptCreationLimit } from '@/lib/receipt-rate-limit';

export const runtime = 'nodejs';
// Covers the upload plus the in-process processing started with waitUntil below, which runs
// inside this function's lifetime.
export const maxDuration = 120;

const ENV_PATH_PREFIX = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
const MAX_UPLOAD_SIZE_MB = 15;
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const auth = await authenticateApiKey(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status, headers: corsHeaders });
    }
    const { user } = auth;

    // Reject oversized bodies before buffering the multipart form.
    const declaredLength = Number(req.headers.get('content-length') || 0);
    if (declaredLength > (MAX_UPLOAD_SIZE_MB + 1) * 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large. Max size: ${MAX_UPLOAD_SIZE_MB}MB` },
        { status: 413, headers: corsHeaders },
      );
    }

    const rateLimit = await checkReceiptCreationLimit(user.id);
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: rateLimit.message },
        { status: 429, headers: { ...corsHeaders, 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    submitLogEvent('extension-upload', 'Extension upload started', correlationId, {
      userId: user.id,
    });

    // Only a file upload is accepted. There used to be an `imageUrl` mode that fetched any
    // caller-supplied URL server-side (internal and metadata addresses included) and republished
    // the response as a public blob. The extension never used it — it always sends the snipped
    // image as `file` — so it was pure attack surface.
    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400, headers: corsHeaders },
      );
    }

    const extension = ALLOWED_TYPES[file.type];
    if (!extension) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP' },
        { status: 400, headers: corsHeaders },
      );
    }

    if (file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large. Max size: ${MAX_UPLOAD_SIZE_MB}MB` },
        { status: 413, headers: corsHeaders },
      );
    }

    // Random suffix so blob URLs are not guessable from the user id and a timestamp.
    const blob = await put(`${ENV_PATH_PREFIX}/receipts/${user.id}/extension.${extension}`, file, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: true,
    });

    submitLogEvent('extension-upload', 'File uploaded to blob storage', correlationId, {
      userId: user.id,
      blobUrl: blob.url,
      fileSize: file.size,
    });

    // Only file into the default household if the user is still a member of it. Leaving or
    // being removed from a household did not clear defaultHouseholdId, so new captures kept
    // appearing in an ex-household.
    let householdId: string | null = null;
    if (user.defaultHouseholdId) {
      const membership = await getHouseholdMembership(user.defaultHouseholdId, user.id);
      householdId = membership ? user.defaultHouseholdId : null;
    }

    const [receipt] = await db
      .insert(receipts)
      .values({
        userId: user.id,
        householdId,
        imageUrl: blob.url,
        processingStatus: 'pending',
      })
      .returning();

    submitLogEvent('extension-upload', 'Receipt created successfully', correlationId, {
      receiptId: receipt.id,
      userId: user.id,
      householdId,
    });

    // Process in-process after the response is sent. This used to be a fire-and-forget HTTP
    // call to NEXT_PUBLIC_APP_URL, which is http://localhost:3000 in production — so every
    // extension upload sat at 'pending' forever. processReceipt records 'failed' itself on error,
    // and the hourly sweeper catches anything the function was killed before finishing.
    waitUntil(
      processReceipt(receipt.id, user.id, correlationId).catch((error) => {
        submitLogEvent('extension-upload', `Background processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {
          receiptId: receipt.id,
        }, true);
      }),
    );

    return NextResponse.json(
      {
        success: true,
        receiptId: receipt.id,
        imageUrl: blob.url,
        processingStatus: 'pending',
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    submitLogEvent('extension-upload', `Extension upload error: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {
      error: error instanceof Error ? error.stack : undefined,
    }, true);

    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500, headers: corsHeaders },
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
