import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { authenticateApiKey } from '@/lib/api-key-auth';
import { checkReceiptCreationLimit } from '@/lib/receipt-rate-limit';
import { IntakeError, intakeReceiptFile, MAX_RECEIPT_UPLOAD_MB } from '@/lib/services/receipt-intake';

export const runtime = 'nodejs';
// Covers the upload plus the in-process processing started with waitUntil below, which runs
// inside this function's lifetime.
export const maxDuration = 120;


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
    if (declaredLength > (MAX_RECEIPT_UPLOAD_MB + 1) * 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large. Max size: ${MAX_RECEIPT_UPLOAD_MB}MB` },
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

    // Stored, filed in the default household, and read after the response; a clip the reader
    // says is a bill goes to the bill inbox (lib/services/receipt-intake.ts).
    const { receipt } = await intakeReceiptFile({ user, file, source: 'extension', fileBills: true, correlationId });

    return NextResponse.json(
      {
        success: true,
        receiptId: receipt.id,
        imageUrl: receipt.imageUrl,
        processingStatus: 'pending',
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    if (error instanceof IntakeError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers: corsHeaders });
    }
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
