import { type NextRequest, NextResponse } from 'next/server';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { randomUUID } from 'crypto';
import { authenticateApiKey } from '@/lib/api-key-auth';
import { processReceipt } from '@/lib/receipt-processing';

export const runtime = 'nodejs';
// Image fetch (≤15s) plus the vision call (≤50s, retries included) plus the database writes.
export const maxDuration = 90;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
};

/**
 * POST /api/extension/process
 *
 * API-key counterpart of /api/receipt/process. /api/extension/upload no longer calls this over
 * HTTP — it runs processReceipt in-process — but the route stays for API clients that upload and
 * then ask for processing explicitly.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const auth = await authenticateApiKey(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status, headers: corsHeaders });
    }
    const { user } = auth;

    const body = await req.json().catch(() => ({}));
    const { receiptId } = body as { receiptId?: unknown };

    if (!receiptId || typeof receiptId !== 'string') {
      return NextResponse.json(
        { error: 'Receipt ID is required' },
        { status: 400, headers: corsHeaders },
      );
    }

    submitLogEvent('extension-process', 'Processing receipt from extension', correlationId, {
      receiptId,
      userId: user.id,
    });

    const result = await processReceipt(receiptId, user.id, correlationId);

    if (!result.ok) {
      if (result.reason === 'already_completed') {
        return NextResponse.json(
          { message: 'Receipt already processed', receiptId },
          { headers: corsHeaders },
        );
      }
      return NextResponse.json(
        { error: result.message },
        { status: result.status, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      {
        success: true,
        receiptId,
        merchant: result.receipt.merchantName,
        total: result.ocrData.total,
        currency: result.receipt.currency,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    submitLogEvent('extension-process', `Processing error: ${error instanceof Error ? error.message : 'Unknown'}`, correlationId, {
      error: error instanceof Error ? error.stack : undefined,
    }, true);

    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
