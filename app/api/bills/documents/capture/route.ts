import { waitUntil } from '@vercel/functions';
import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { billFromParts, CaptureError, MAX_CAPTURE_BYTES } from '@/lib/bill-capture';
import { checkBillDocumentLimit } from '@/lib/bill-rate-limit';
import { db } from '@/lib/db';
import { billDocuments } from '@/lib/db/schema';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE } from '@/lib/route-guards';
import { processBillDocument, toClientDocument } from '@/lib/services/bill-document-service';
import { canFileFinanceRowUnder } from '@/lib/services/finance-access';
import { billsPrefix, isPrivateStoreConfigured, putPrivate } from '@/lib/storage/private-blob';

export const runtime = 'nodejs';
export const maxDuration = 90;

/** The app's id for one capture, sent as the Idempotency-Key header (as for receipts). */
const UPLOAD_ID = /^[A-Za-z0-9_-]{8,64}$/;
const EXTENSIONS = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;

/**
 * A bill from the app, in one multipart request: one PDF or photo as `file`, or up to ten pages
 * of a scan, each as `file`, which become one PDF (lib/bill-capture.ts). `householdId` files it in
 * a household; '' or absent is personal. Everything together must be under 4 MB: a bigger PDF
 * goes by email to the forwarding address instead.
 *
 * The web uploads straight to the private store and then registers the file; the app can't use
 * that handshake, so it sends the bytes here. The Idempotency-Key header makes a retry after a
 * dropped connection return the first document.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = await guardFinanceRoute(req, { mutating: true, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;

  if (!isPrivateStoreConfigured()) {
    return NextResponse.json({ error: 'Bill uploads are not set up yet' }, { status: 503 });
  }

  try {
    if (Number(req.headers.get('content-length') || 0) > MAX_CAPTURE_BYTES + 64 * 1024) {
      return NextResponse.json({ error: 'That file is too large to send from the app. Forward it by email instead.' }, { status: 413 });
    }
    const uploadId = req.headers.get('idempotency-key');
    if (uploadId !== null && !UPLOAD_ID.test(uploadId)) {
      return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 });
    }
    const existing = uploadId ? await findByClientUploadId(user.id, uploadId) : null;
    if (existing) return NextResponse.json(toClientDocument(existing), { headers: PRIVATE_NO_STORE });

    const form = await req.formData();
    const files = form.getAll('file').filter((value): value is File => value instanceof File);
    const rawHousehold = form.get('householdId');
    const household = z.union([z.literal(''), z.string().uuid()]).nullable().safeParse(rawHousehold);
    if (!household.success) return NextResponse.json({ error: 'Invalid household' }, { status: 400 });
    const householdId = household.data || null;
    const fileName = typeof form.get('fileName') === 'string' ? (form.get('fileName') as string).trim().slice(0, 200) || null : null;

    if (!(await canFileFinanceRowUnder(householdId, user.id, entitlements))) {
      return NextResponse.json({ error: householdId ? 'Not a member of this household' : 'Active subscription required' }, { status: 403 });
    }
    const limit = await checkBillDocumentLimit(user.id);
    if (limit.limited) {
      return NextResponse.json({ error: limit.message }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
    }

    const { bytes, mimeType } = await billFromParts(await Promise.all(files.map(async (file) => new Uint8Array(await file.arrayBuffer()))));
    const pathname = `${billsPrefix(user.id)}${randomUUID()}.${EXTENSIONS[mimeType]}`;
    await putPrivate(pathname, Buffer.from(bytes), mimeType);

    const [document] = await db
      .insert(billDocuments)
      .values({ userId: user.id, householdId, source: 'app', blobPathname: pathname, mimeType, fileName, sizeBytes: bytes.byteLength, clientUploadId: uploadId })
      // Two sends of the same capture at once: the other one made the row.
      .onConflictDoNothing({ target: [billDocuments.userId, billDocuments.clientUploadId] })
      .returning();
    if (!document) {
      const first = uploadId ? await findByClientUploadId(user.id, uploadId) : null;
      if (first) return NextResponse.json(toClientDocument(first), { headers: PRIVATE_NO_STORE });
      throw new Error('Bill was not created');
    }

    waitUntil(processBillDocument(document.id, correlationId));
    submitLogEvent('bill-document', 'Bill sent from the app', correlationId, { documentId: document.id, userId: user.id, pages: files.length });
    return NextResponse.json(toClientDocument(document), { status: 201, headers: PRIVATE_NO_STORE });
  } catch (error) {
    if (error instanceof CaptureError) return NextResponse.json({ error: error.message }, { status: error.status });
    submitLogEvent('bill-document', `App bill capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to add the bill' }, { status: 500 });
  }
}

async function findByClientUploadId(userId: string, clientUploadId: string) {
  const [document] = await db
    .select()
    .from(billDocuments)
    .where(and(eq(billDocuments.userId, userId), eq(billDocuments.clientUploadId, clientUploadId)))
    .limit(1);
  return document ?? null;
}
