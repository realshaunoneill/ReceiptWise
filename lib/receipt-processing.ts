import { APICallError, NoObjectGeneratedError, RetryError, TypeValidationError, JSONParseError } from 'ai';
import { and, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { receipts, receiptItems, users, type Receipt, type ReceiptItem } from '@/lib/db/schema';
import { analyzeReceiptWithGPT4o, type ReceiptData, type TokenUsage } from '@/lib/openai';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { invalidateInsightsCache } from '@/lib/utils/cache-helpers';
import { DEFAULT_CURRENCY } from '@/lib/utils/currency';

/*
 * The one implementation of "read a receipt image and store what it says".
 *
 * There used to be three — /api/receipt/process, /api/receipts/[id]/retry and
 * /api/extension/process — and they had drifted: one defaulted a missing total to '0' and the
 * others to null, one set isReceipt and the others didn't, one left stale line items behind on
 * re-analysis, and the extension path never wrote 'failed', so an OpenAI error left the receipt in
 * 'processing' where the retry route refused to touch it. None of them claimed the row
 * atomically, so a client retry racing the server inserted every line item twice.
 */

/**
 * A 'processing' row older than this is treated as abandoned (the function that claimed it was
 * killed or timed out) and may be claimed again. Longer than any route's maxDuration.
 */
export const STALE_PROCESSING_MS = 5 * 60 * 1000;

export type ProcessReceiptOptions = {
  /** Allow a completed receipt to be read again (the explicit "Re-analyze" action only). */
  allowReanalyze?: boolean;
};

export type ProcessReceiptSuccess = {
  ok: true;
  receipt: Receipt;
  items: ReceiptItem[];
  ocrData: ReceiptData;
  usage: TokenUsage;
};

export type ProcessReceiptFailure = {
  ok: false;
  reason: 'not_found' | 'already_completed' | 'in_progress' | 'failed';
  /** Safe to show to the user. */
  message: string;
  status: number;
};

export type ProcessReceiptResult = ProcessReceiptSuccess | ProcessReceiptFailure;

/**
 * Turn a processing error into a message that is safe to store in `processingError` and show in
 * the UI. Raw messages (stack details, provider error bodies) stay in the logs.
 */
export function describeProcessingError(error: unknown): string {
  const inner = RetryError.isInstance(error) ? error.lastError : error;
  const name = inner instanceof Error ? inner.name : '';

  if (name === 'TimeoutError' || name === 'AbortError') {
    return 'Reading this receipt took too long. Try again.';
  }
  if (inner instanceof Error && inner.message.startsWith('Failed to download image')) {
    return "The receipt image couldn't be loaded. Try uploading it again.";
  }
  if (
    NoObjectGeneratedError.isInstance(inner) ||
    TypeValidationError.isInstance(inner) ||
    JSONParseError.isInstance(inner)
  ) {
    return "We couldn't read this receipt. Try again, or upload a clearer photo.";
  }
  if (APICallError.isInstance(inner) && (inner.statusCode === 429 || (inner.statusCode ?? 0) >= 500)) {
    return 'The receipt reader is busy right now. Try again in a minute.';
  }
  return 'Something went wrong reading this receipt. Try again.';
}

function toNumber(value: number | string | null | undefined, fallback: number): number {
  if (value === null || value === undefined) return fallback;
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toAmountString(value: number | null | undefined): string | null {
  return typeof value === 'number' && Number.isFinite(value) ? value.toString() : null;
}

function normalizeCurrency(value: string | null | undefined): string | null {
  const code = value?.trim().toUpperCase();
  return code && /^[A-Z]{3}$/.test(code) ? code : null;
}

/**
 * Collect the AI SDK's diagnostic fields (raw model text, validation issues) for the logs.
 */
function errorDetails(error: unknown): Record<string, unknown> {
  const details: Record<string, unknown> = {
    errorMessage: error instanceof Error ? error.message : 'Unknown error',
    errorName: error instanceof Error ? error.name : undefined,
    errorStack: error instanceof Error ? error.stack : undefined,
  };
  if (error && typeof error === 'object') {
    if ('text' in error) details.rawAIResponse = (error as { text?: string }).text;
    if ('cause' in error) details.errorCause = (error as { cause?: unknown }).cause;
    if ('issues' in error) details.validationIssues = (error as { issues?: unknown }).issues;
  }
  return details;
}

/**
 * Claim, analyse and store one receipt belonging to `userId`.
 *
 * Callers are responsible for authentication and for the subscription / blocked / pending-deletion
 * gates; this function only enforces ownership. It never throws for an expected failure — the
 * result says what happened and carries a user-safe message and an HTTP status.
 */
export async function processReceipt(
  receiptId: string,
  userId: string,
  correlationId: CorrelationId,
  options: ProcessReceiptOptions = {},
): Promise<ProcessReceiptResult> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return { ok: false, reason: 'not_found', message: 'Receipt not found', status: 404 };
  }

  const claimableStatuses = options.allowReanalyze ? ['pending', 'failed', 'completed'] : ['pending', 'failed'];

  // Atomic claim: exactly one caller moves the row to 'processing'. A second concurrent call (a
  // client retry, a double-click, the extension's trigger racing a manual retry) gets nothing
  // back and stops, instead of running the model again and inserting every line item twice.
  const [claimed] = await db
    .update(receipts)
    .set({ processingStatus: 'processing', processingError: null, updatedAt: new Date() })
    .where(
      and(
        eq(receipts.id, receiptId),
        eq(receipts.userId, userId),
        isNull(receipts.deletedAt),
        or(
          inArray(receipts.processingStatus, claimableStatuses),
          and(
            eq(receipts.processingStatus, 'processing'),
            lt(receipts.updatedAt, new Date(Date.now() - STALE_PROCESSING_MS)),
          ),
        ),
      ),
    )
    .returning();

  if (!claimed) {
    const [existing] = await db
      .select({ status: receipts.processingStatus })
      .from(receipts)
      .where(and(eq(receipts.id, receiptId), eq(receipts.userId, userId), isNull(receipts.deletedAt)))
      .limit(1);

    if (!existing) {
      return { ok: false, reason: 'not_found', message: 'Receipt not found', status: 404 };
    }
    if (existing.status === 'completed') {
      return { ok: false, reason: 'already_completed', message: 'This receipt has already been read.', status: 409 };
    }
    return {
      ok: false,
      reason: 'in_progress',
      message: 'This receipt is being read right now. Give it a minute.',
      status: 409,
    };
  }

  submitLogEvent('receipt-status-processing', 'Receipt claimed for processing', correlationId, {
    receiptId,
    userId,
    householdId: claimed.householdId,
    reanalyze: !!options.allowReanalyze,
    timestamp: new Date().toISOString(),
  });

  let ocrData: ReceiptData;
  let usage: TokenUsage;
  try {
    const result = await analyzeReceiptWithGPT4o(claimed.imageUrl, user.email, user.id, correlationId);
    ocrData = result.data;
    usage = result.usage;
  } catch (error) {
    const message = describeProcessingError(error);
    await db
      .update(receipts)
      .set({ processingStatus: 'failed', processingError: message, updatedAt: new Date() })
      .where(eq(receipts.id, receiptId));

    submitLogEvent('receipt-error', `Receipt processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {
      receiptId,
      userId,
      imageUrl: claimed.imageUrl,
      ...errorDetails(error),
    }, true);

    return { ok: false, reason: 'failed', message, status: 502 };
  }

  submitLogEvent('receipt-process', 'Receipt analyzed with enhanced data', correlationId, {
    receiptId,
    merchant: ocrData.merchant,
    total: ocrData.total,
    currency: ocrData.currency,
    date: ocrData.date,
    category: ocrData.category,
    isReceipt: ocrData.isReceipt,
    itemCount: ocrData.items?.length || 0,
    extractedFields: Object.keys(ocrData).length,
    userId,
  });

  const itemsToInsert = (Array.isArray(ocrData.items) ? ocrData.items : []).map((item) => {
    const quantity = toNumber(item.quantity, 1);
    const totalPrice = toNumber(item.price, 0);
    const unitPrice = quantity > 0 ? totalPrice / quantity : totalPrice;
    return {
      receiptId,
      name: item.name || 'Unknown Item',
      quantity: quantity.toString(),
      unitPrice: unitPrice.toString(),
      totalPrice: totalPrice.toString(),
      price: totalPrice.toString(), // Kept for backward compatibility with the UI
      category: item.category || null,
      description: item.description || null,
      modifiers: item.modifiers || null,
    };
  });

  try {
    const { receipt, items } = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(receipts)
        .set({
          merchantName: ocrData.merchant || 'Unknown Merchant',
          totalAmount: toAmountString(ocrData.total) ?? '0',
          currency: normalizeCurrency(ocrData.currency) || user.currency || DEFAULT_CURRENCY,
          // The prompt tells the model to use today's date when none is visible; this covers
          // a missing or unparseable value the same way.
          transactionDate: ocrData.date || new Date().toISOString().split('T')[0],
          location: ocrData.location || null,
          tax: toAmountString(ocrData.tax),
          serviceCharge: toAmountString(ocrData.serviceCharge),
          subtotal: toAmountString(ocrData.subtotal),
          receiptNumber: ocrData.receiptNumber || null,
          paymentMethod: ocrData.paymentMethod || null,
          category: ocrData.category || 'other',
          isReceipt: ocrData.isReceipt ?? true,
          ocrData,
          processingTokens: usage,
          processingStatus: 'completed',
          processingError: null,
          updatedAt: new Date(),
        })
        .where(eq(receipts.id, receiptId))
        .returning();

      // Replace, never append: re-analysis used to leave the previous run's items in place
      // whenever the new run returned no items.
      await tx.delete(receiptItems).where(eq(receiptItems.receiptId, receiptId));
      const inserted = itemsToInsert.length > 0
        ? await tx.insert(receiptItems).values(itemsToInsert).returning()
        : [];

      return { receipt: updated, items: inserted };
    });

    submitLogEvent('receipt-process-complete', 'Receipt updated in database with OCR data', correlationId, {
      receiptId,
      userId,
      tokenUsage: usage,
      merchantName: receipt.merchantName,
      totalAmount: receipt.totalAmount,
      itemCount: items.length,
      reanalyze: !!options.allowReanalyze,
      timestamp: new Date().toISOString(),
    });

    await invalidateInsightsCache(userId, receipt.householdId, correlationId);

    return { ok: true, receipt, items, ocrData, usage };
  } catch (error) {
    const message = 'Something went wrong saving this receipt. Try again.';
    await db
      .update(receipts)
      .set({ processingStatus: 'failed', processingError: message, updatedAt: new Date() })
      .where(eq(receipts.id, receiptId));

    submitLogEvent('receipt-error', `Saving processed receipt failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {
      receiptId,
      userId,
      ...errorDetails(error),
    }, true);

    return { ok: false, reason: 'failed', message, status: 500 };
  }
}
