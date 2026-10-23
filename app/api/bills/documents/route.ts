import { waitUntil } from '@vercel/functions';
import { type NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gte, inArray, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { billDocuments } from '@/lib/db/schema';
import { checkBillDocumentLimit } from '@/lib/bill-rate-limit';
import { submitLogEvent } from '@/lib/logging';
import { guardFinanceRoute, PRIVATE_NO_STORE, scopeFromSearchParams } from '@/lib/route-guards';
import { matchSuggestions, processBillDocument, toClientDocument } from '@/lib/services/bill-document-service';
import { canFileFinanceRowUnder, financeScopeCondition } from '@/lib/services/finance-access';
import { BILL_MIME_TYPES, headPrivate, isOwnBillPath, MAX_BILL_BYTES } from '@/lib/storage/private-blob';
import { parseBody, readJson } from '@/lib/validation/finance';

export const runtime = 'nodejs';
export const maxDuration = 90;

/** Bills filed automatically stay in the inbox this long, marked as done. */
const RECENTLY_FILED_MS = 3 * 24 * 60 * 60 * 1000;

// GET /api/bills/documents - Bills brought in, newest first (?householdId=; ?review=true for the
// ones waiting to be filed, with suggestions)
export async function GET(req: NextRequest) {
  const guard = await guardFinanceRoute(req, { mutating: false, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;

  try {
    const { searchParams } = new URL(req.url);
    const condition = financeScopeCondition(billDocuments, user.id, scopeFromSearchParams(searchParams), entitlements);
    if (!condition) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

    const review = searchParams.get('review') === 'true';
    const rows = await db
      .select()
      .from(billDocuments)
      .where(and(
        condition,
        isNull(billDocuments.deletedAt),
        // Waiting to be filed, or filed automatically in the last few days (so the user sees it happened).
        review
          ? or(
            inArray(billDocuments.reviewStatus, ['pending_review', 'needs_document', 'not_a_bill']),
            and(eq(billDocuments.autoApplied, true), gte(billDocuments.reviewedAt, new Date(Date.now() - RECENTLY_FILED_MS))),
          )
          : undefined,
      ))
      .orderBy(desc(billDocuments.createdAt))
      .limit(50);

    const withSuggestions = await Promise.all(rows.map(async (row) => ({
      ...toClientDocument(row),
      suggestions: row.reviewStatus === 'pending_review' && row.processingStatus === 'completed' ? await matchSuggestions(row) : [],
    })));
    return NextResponse.json(withSuggestions, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('bill-document', `Error listing bills: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to load bills' }, { status: 500 });
  }
}

const registerSchema = z.object({
  pathname: z.string().min(1).max(500),
  fileName: z.string().trim().max(200).nullable().optional(),
  householdId: z.string().uuid().nullable().optional(),
}).strict();

// POST /api/bills/documents - Register a file just uploaded to the private store and start reading it
export async function POST(req: NextRequest) {
  const guard = await guardFinanceRoute(req, { mutating: true, feature: 'bills' });
  if (guard instanceof NextResponse) return guard;
  const { user, correlationId, entitlements } = guard;

  try {
    const parsed = parseBody(registerSchema, await readJson(req));
    if (parsed instanceof NextResponse) return parsed;
    const { pathname, fileName } = parsed.data;
    const householdId = parsed.data.householdId ?? null;

    if (!isOwnBillPath(pathname, user.id)) return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
    if (!(await canFileFinanceRowUnder(householdId, user.id, entitlements))) {
      return NextResponse.json({ error: householdId ? 'Not a member of this household' : 'Active subscription required' }, { status: 403 });
    }

    const limit = await checkBillDocumentLimit(user.id);
    if (limit.limited) {
      return NextResponse.json({ error: limit.message }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
    }

    // The upload went straight from the browser to the store; check what actually arrived.
    const blob = await headPrivate(pathname).catch(() => null);
    if (!blob) return NextResponse.json({ error: 'The upload didn\'t arrive. Try again.' }, { status: 400 });
    const mimeType = blob.contentType.split(';')[0].trim();
    if (!(BILL_MIME_TYPES as readonly string[]).includes(mimeType) || blob.size > MAX_BILL_BYTES) {
      return NextResponse.json({ error: 'Upload a PDF, JPEG, PNG or WebP under 15 MB' }, { status: 400 });
    }

    const [document] = await db
      .insert(billDocuments)
      .values({ userId: user.id, householdId, source: 'upload', blobPathname: pathname, mimeType, fileName: fileName ?? null, sizeBytes: blob.size })
      .returning();

    waitUntil(processBillDocument(document.id, correlationId));

    submitLogEvent('bill-document', 'Bill uploaded', correlationId, { documentId: document.id, userId: user.id });
    return NextResponse.json(toClientDocument(document), { status: 201, headers: PRIVATE_NO_STORE });
  } catch (error) {
    submitLogEvent('bill-document', `Error registering bill: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to add the bill' }, { status: 500 });
  }
}
