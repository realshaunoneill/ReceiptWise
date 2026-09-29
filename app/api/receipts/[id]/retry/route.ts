import { type NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedUser,
  filterReceiptForSubscription,
  requireSubscription,
  requireNoPendingDeletion,
  requireReceiptOwner,
} from '@/lib/auth-helpers';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { getReceiptById } from '@/lib/receipt-scanner';
import { randomUUID } from 'crypto';
import { processReceipt } from '@/lib/receipt-processing';

export const runtime = 'nodejs';
// Image fetch (≤15s) plus the vision call (≤50s, retries included) plus the database writes.
export const maxDuration = 90;

/**
 * Minimum gap between re-analyses of an already-completed receipt. "Report issue → Re-analyze"
 * had no limit, so the button could be driven in a loop, each click a GPT-4o vision call.
 */
const REANALYZE_COOLDOWN_MS = 60 * 1000;

/**
 * POST /api/receipts/[id]/retry
 * Retry a failed or stuck receipt, or re-analyze a completed one.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // Every retry is a paid model call, so it gets the same gates as /api/receipt/process.
    const subCheck = await requireSubscription(user);
    if (subCheck) return subCheck;

    const deletionCheck = requireNoPendingDeletion(user);
    if (deletionCheck) return deletionCheck;

    const { id: receiptId } = await params;

    const receipt = await getReceiptById(receiptId);

    if (!receipt) {
      return NextResponse.json({ error: 'Receipt not found', message: 'Receipt not found' }, { status: 404 });
    }

    // Owner only — household members can see a shared receipt but must not spend its owner's
    // processing on it. (Admins pass this check but processReceipt still scopes to the owner.)
    const ownerCheck = await requireReceiptOwner(receipt, user, correlationId);
    if (ownerCheck) return ownerCheck;

    if (receipt.userId !== user.id) {
      return NextResponse.json(
        { error: 'Only the person who uploaded this receipt can re-read it', message: 'Only the person who uploaded this receipt can re-read it' },
        { status: 403 },
      );
    }

    const isReanalysis = receipt.processingStatus === 'completed';
    if (isReanalysis && Date.now() - receipt.updatedAt.getTime() < REANALYZE_COOLDOWN_MS) {
      return NextResponse.json(
        { error: 'Too soon', message: 'This receipt was just read. Wait a minute before trying again.' },
        { status: 429 },
      );
    }

    submitLogEvent('receipt-retry', 'User initiated receipt retry', correlationId, {
      receiptId: receipt.id,
      userId: user.id,
      previousStatus: receipt.processingStatus,
      reanalyze: isReanalysis,
      timestamp: new Date().toISOString(),
    });

    const result = await processReceipt(receipt.id, user.id, correlationId, { allowReanalyze: isReanalysis });

    if (!result.ok) {
      return NextResponse.json(
        { error: 'Failed to process receipt', message: result.message },
        { status: result.status },
      );
    }

    // Filter based on subscription status
    const filteredReceipt = filterReceiptForSubscription({ ...result.receipt, items: result.items }, user.subscribed);

    return NextResponse.json({
      success: true,
      receipt: filteredReceipt,
    });
  } catch (error) {
    submitLogEvent('receipt-error', `Receipt retry error: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {
      error: error instanceof Error ? error.stack : undefined,
    }, true);

    // Stack traces and raw messages stay in the logs, never in the response body.
    return NextResponse.json(
      {
        error: 'Failed to process receipt',
        message: 'Something went wrong reading this receipt. Try again.',
      },
      { status: 500 },
    );
  }
}
