import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAuthenticatedUser, requireNoPendingDeletion, requireSubscription } from '@/lib/auth-helpers';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { checkReceiptCreationLimit } from '@/lib/receipt-rate-limit';
import { findByClientUploadId, IntakeError, intakeReceiptFile, MAX_RECEIPT_UPLOAD_MB } from '@/lib/services/receipt-intake';

export const runtime = 'nodejs';
// The upload, plus reading it in waitUntil after the response, inside this function's lifetime.
export const maxDuration = 120;

/** The app's id for one capture, sent as the Idempotency-Key header. */
const UPLOAD_ID = /^[A-Za-z0-9_-]{8,64}$/;
const KINDS = ['receipt', 'auto'] as const;
const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * A receipt photographed or chosen in the app, in one multipart request:
 * - `file`: JPEG, PNG or WebP. The app compresses it to well under Vercel's 4.5 MB body limit.
 * - `householdId`: the household to file it in, '' for personal, or absent for the default one.
 * - `kind`: 'receipt' (the default) keeps it a receipt; 'auto' moves it to the bill inbox if the
 *   reader says it's a bill, as the extension does.
 *
 * The Idempotency-Key header names the capture: the app retries when a connection drops, and the
 * same key again returns the first receipt. It's read on the server after the response, so it
 * completes even if the phone goes to sleep.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const subCheck = await requireSubscription(user);
    if (subCheck) return subCheck;
    const deletionCheck = requireNoPendingDeletion(user);
    if (deletionCheck) return deletionCheck;

    const declaredLength = Number(req.headers.get('content-length') || 0);
    if (declaredLength > (MAX_RECEIPT_UPLOAD_MB + 1) * 1024 * 1024) {
      return NextResponse.json({ error: `File too large. Max size: ${MAX_RECEIPT_UPLOAD_MB}MB` }, { status: 413 });
    }

    const uploadId = req.headers.get('idempotency-key');
    if (uploadId !== null && !UPLOAD_ID.test(uploadId)) {
      return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 });
    }
    // A retry of a capture that already arrived: the same receipt, whatever the rate limit says.
    if (uploadId) {
      const existing = await findByClientUploadId(user.id, uploadId);
      if (existing) {
        return NextResponse.json({ receiptId: existing.id, processingStatus: existing.processingStatus, created: false }, { headers: NO_STORE });
      }
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    const rawHousehold = formData.get('householdId');
    if (rawHousehold !== null && typeof rawHousehold !== 'string') {
      return NextResponse.json({ error: 'Invalid household' }, { status: 400 });
    }
    const kind = (formData.get('kind') ?? 'receipt') as string;
    if (!(KINDS as readonly string[]).includes(kind)) {
      return NextResponse.json({ error: "kind must be 'receipt' or 'auto'" }, { status: 400 });
    }

    const rateLimit = await checkReceiptCreationLimit(user.id);
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: rateLimit.message },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    const { receipt, created } = await intakeReceiptFile({
      user,
      file,
      source: 'app',
      householdId: rawHousehold === null ? undefined : rawHousehold === '' ? null : rawHousehold,
      clientUploadId: uploadId,
      fileBills: kind === 'auto',
      correlationId,
    });

    return NextResponse.json(
      { receiptId: receipt.id, processingStatus: receipt.processingStatus, created },
      { status: created ? 201 : 200, headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof IntakeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    submitLogEvent('app-upload', `App capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
