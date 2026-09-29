import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { receipts } from '@/lib/db/schema';
import {
  getAuthenticatedUser,
  getHouseholdMembership,
  requireHouseholdMembership,
  requireSubscription,
  requireNoPendingDeletion,
} from '@/lib/auth-helpers';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { getConsentedPostHogClient } from '@/lib/posthog-server';
import { waitUntil } from '@vercel/functions';
import { randomUUID } from 'crypto';
import { checkReceiptCreationLimit } from '@/lib/receipt-rate-limit';

// Route configuration
export const runtime = 'nodejs';

const ENV_PATH_PREFIX = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';

/**
 * The image must be one this app uploaded: a Vercel Blob URL under this environment's receipts
 * prefix. Anything else would be fetched server-side for OCR (a blind SSRF), rendered as an
 * <img> to every household member (a tracking pixel), and handed to blob del() on deletion.
 */
function isOwnBlobUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  try {
    const url = new URL(raw);
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.public.blob.vercel-storage.com') &&
      url.pathname.startsWith(`/${ENV_PATH_PREFIX}/receipts/`)
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user, clerkId } = authResult;

    // Check subscription
    const subCheck = await requireSubscription(user);
    if (subCheck) return subCheck;

    const deletionCheck = requireNoPendingDeletion(user);
    if (deletionCheck) return deletionCheck;

    const body = await req.json();
    const { imageUrl, householdId: providedHouseholdId } = body;

    if (!isOwnBlobUrl(imageUrl)) {
      return NextResponse.json(
        { error: 'A receipt image uploaded through ReceiptWise is required' },
        { status: 400 },
      );
    }

    // Filing into a household needs membership of it. Without this any subscriber could write
    // receipts into any household whose id they knew (an ex-member, say).
    if (providedHouseholdId) {
      if (typeof providedHouseholdId !== 'string') {
        return NextResponse.json({ error: 'Invalid household' }, { status: 400 });
      }
      const membershipCheck = await requireHouseholdMembership(providedHouseholdId, user.id, correlationId);
      if (membershipCheck) return membershipCheck;
    }

    const rateLimit = await checkReceiptCreationLimit(user.id);
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: rateLimit.message, message: rateLimit.message },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    submitLogEvent('receipt-upload-start', 'Creating receipt database entry', correlationId, {
      userId: user.id,
      clerkId,
      imageUrl,
      householdId: providedHouseholdId,
      timestamp: new Date().toISOString(),
    });

    // Use provided householdId or fall back to user's default — but only a default the user is
    // still a member of. Leaving a household did not clear defaultHouseholdId, so uploads kept
    // landing in the old one, visible to its remaining members.
    let householdId: string | null = providedHouseholdId || null;
    if (!householdId && user.defaultHouseholdId) {
      const membership = await getHouseholdMembership(user.defaultHouseholdId, user.id);
      householdId = membership ? user.defaultHouseholdId : null;
    }

    if (householdId && user.defaultHouseholdId && householdId !== user.defaultHouseholdId) {
      submitLogEvent('receipt-upload', 'Using provided household for receipt', correlationId, {
        providedHouseholdId: householdId,
        defaultHouseholdId: user.defaultHouseholdId,
      });
    } else if (householdId && !providedHouseholdId) {
      submitLogEvent('receipt-upload', 'Using default household for receipt', correlationId, {
        defaultHouseholdId: user.defaultHouseholdId,
      });
    }

    // Create receipt entry in database with pending status
    const [receipt] = await db
      .insert(receipts)
      .values({
        userId: user.id,
        householdId,
        imageUrl,
        processingStatus: 'pending',
      })
      .returning();

    submitLogEvent('receipt-db-created', 'Receipt entry created in database with pending status', correlationId, {
      receiptId: receipt.id,
      userId: user.id,
      clerkId,
      imageUrl,
      householdId,
      processingStatus: 'pending',
      timestamp: new Date().toISOString(),
    });

    // Track receipt upload event in PostHog (if enabled)
    // The image URL is deliberately not sent: it is a public link to someone's receipt.
    // Only for visitors who accepted analytics in the consent banner.
    const posthog = await getConsentedPostHogClient();
    if (posthog) {
      posthog.capture({
        distinctId: clerkId,
        event: 'receipt_uploaded',
        properties: {
          receiptId: receipt.id,
          householdId,
          hasHousehold: !!householdId,
          timestamp: new Date().toISOString(),
        },
      });
      // Without waitUntil the function can be frozen before the event is sent.
      waitUntil(posthog.flush());
    }

    submitLogEvent('receipt-upload-complete', 'Receipt upload flow completed, ready for processing', correlationId, {
      receiptId: receipt.id,
      userId: user.id,
      imageUrl,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      receiptId: receipt.id,
      processingStatus: 'pending',
      imageUrl,
    });
  } catch (error) {
    submitLogEvent('receipt-error', `Failed to create receipt entry: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {
      error: error instanceof Error ? error.stack : undefined,
    }, true);

    // Raw messages stay in the logs, never in the response body.
    return NextResponse.json(
      {
        error: 'Failed to create receipt entry',
        message: 'Something went wrong saving this receipt. Try again.',
      },
      { status: 500 },
    );
  }
}
