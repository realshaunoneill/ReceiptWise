import { createHash } from 'crypto';
import { APICallError, JSONParseError, NoObjectGeneratedError, NoOutputGeneratedError, RetryError, TypeValidationError } from 'ai';
import { and, eq, inArray, isNull, lt, ne, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { billDocuments, planEntries, subscriptions, type BillDocument, type Subscription } from '@/lib/db/schema';
import { localToday } from '@/lib/dates/local-date';
import { analyzeBillDocument, isEncryptedPdf, type BillData } from '@/lib/bill-extraction';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { fromCents, toCents } from '@/lib/money';
import {
  documentFingerprint,
  frequencyFromPeriod,
  type MatchSuggestion,
  normaliseProvider,
  shouldAutoApply,
  suggestMatches,
} from '@/lib/provider-matching';
import { STALE_PROCESSING_MS } from '@/lib/receipt-processing';
import { readPrivate } from '@/lib/storage/private-blob';
import { SubscriptionService } from '@/lib/services/subscription-service';

/**
 * Bills brought in by upload or email: read them, then file each one against the recurring bill
 * it belongs to (setting that month's amount and due date), as a new recurring bill, or as a
 * one-off in the plan. Follows the receipt pipeline's claim/fail pattern (lib/receipt-processing.ts)
 * without sharing its code, so the live receipt path is untouched.
 */

const MAX_ATTEMPTS = 3;

function describeBillError(error: unknown): string {
  const inner = RetryError.isInstance(error) ? error.lastError : error;
  const name = inner instanceof Error ? inner.name : '';
  if (name === 'TimeoutError' || name === 'AbortError') return 'Reading this bill took too long. Try again.';
  if (NoObjectGeneratedError.isInstance(inner) || NoOutputGeneratedError.isInstance(inner) || TypeValidationError.isInstance(inner) || JSONParseError.isInstance(inner)) {
    return "We couldn't read this bill. Try again, or upload a clearer copy.";
  }
  if (APICallError.isInstance(inner) && (inner.statusCode === 429 || (inner.statusCode ?? 0) >= 500)) {
    return 'The bill reader is busy right now. Try again in a minute.';
  }
  return 'Something went wrong reading this bill. Try again.';
}

/** What the client sees of a document: never the file's pathname, nor the raw extraction. */
export function toClientDocument<T extends { blobPathname: string; extracted: unknown }>(document: T) {
  const { blobPathname: _blobPathname, extracted: _extracted, ...rest } = document;
  return rest;
}

export async function getBillDocument(id: string): Promise<BillDocument | null> {
  const [document] = await db.select().from(billDocuments).where(and(eq(billDocuments.id, id), isNull(billDocuments.deletedAt))).limit(1);
  return document ?? null;
}

/** Recurring items a document could be filed against: its owner's, and those shared in its household. */
async function candidatesFor(document: BillDocument): Promise<Subscription[]> {
  return db
    .select()
    .from(subscriptions)
    .where(and(
      ne(subscriptions.status, 'cancelled'),
      document.householdId
        ? or(eq(subscriptions.userId, document.userId), eq(subscriptions.householdId, document.householdId))
        : eq(subscriptions.userId, document.userId),
    ));
}

export async function matchSuggestions(document: BillDocument): Promise<MatchSuggestion[]> {
  const candidates = await candidatesFor(document);
  return suggestMatches({ providerKey: document.providerKey, amountCents: toCents(document.amountDue) }, candidates);
}

function reviewStatusFor(data: BillData): BillDocument['reviewStatus'] {
  if (data.documentType === 'bill_notification') return 'needs_document';
  if (data.documentType === 'receipt' || data.documentType === 'bank_statement' || data.documentType === 'other') return 'not_a_bill';
  return 'pending_review';
}

/**
 * Claim one document, read it, store what it says, flag a duplicate, and file it automatically if
 * nothing is in doubt. Returns the document, or null if someone else is already processing it (or
 * it's gone). Never throws for an expected failure: the row records it.
 */
export async function processBillDocument(documentId: string, correlationId: CorrelationId): Promise<BillDocument | null> {
  const [claimed] = await db
    .update(billDocuments)
    .set({ processingStatus: 'processing', processingError: null, updatedAt: new Date() })
    .where(and(
      eq(billDocuments.id, documentId),
      isNull(billDocuments.deletedAt),
      lt(billDocuments.processingAttempts, MAX_ATTEMPTS),
      or(
        inArray(billDocuments.processingStatus, ['pending', 'failed']),
        and(eq(billDocuments.processingStatus, 'processing'), lt(billDocuments.updatedAt, new Date(Date.now() - STALE_PROCESSING_MS))),
      ),
    ))
    .returning();
  if (!claimed) return null;

  const fail = async (message: string) => {
    const [failed] = await db
      .update(billDocuments)
      .set({ processingStatus: 'failed', processingError: message, processingAttempts: claimed.processingAttempts + 1, updatedAt: new Date() })
      .where(eq(billDocuments.id, documentId))
      .returning();
    return failed;
  };

  try {
    const bytes = await readPrivate(claimed.blobPathname);
    if (!bytes) return fail("The file couldn't be found. Upload it again.");
    if (claimed.mimeType === 'application/pdf' && isEncryptedPdf(bytes)) {
      return fail('This PDF is password-protected. Save a copy without the password, or upload a photo of it.');
    }

    const { data, usage } = claimed.mimeType === 'text/plain'
      ? await analyzeBillDocument({ kind: 'text', text: bytes.toString('utf8') }, { userId: claimed.userId, documentId, correlationId })
      : await analyzeBillDocument({ kind: 'file', bytes, mimeType: claimed.mimeType, fileName: claimed.fileName }, { userId: claimed.userId, documentId, correlationId });

    const amountCents = data.amountDue === null ? null : toCents(data.amountDue);
    const providerKey = normaliseProvider(data.provider);
    const fingerprint = documentFingerprint(providerKey, amountCents, data.dueDate);
    const contentHash = createHash('sha256').update(bytes).digest('hex');

    const [duplicate] = await db
      .select({ id: billDocuments.id })
      .from(billDocuments)
      .where(and(
        eq(billDocuments.userId, claimed.userId),
        isNull(billDocuments.deletedAt),
        ne(billDocuments.id, documentId),
        fingerprint ? or(eq(billDocuments.contentHash, contentHash), eq(billDocuments.fingerprint, fingerprint)) : eq(billDocuments.contentHash, contentHash),
      ))
      .limit(1);

    const toAmount = (value: number | null) => (value === null ? null : (() => {
      const cents = toCents(value);
      return cents === null ? null : fromCents(cents);
    })());

    const [stored] = await db
      .update(billDocuments)
      .set({
        processingStatus: 'completed',
        processingError: null,
        processingAttempts: claimed.processingAttempts + 1,
        processingTokens: usage,
        documentType: data.documentType,
        extracted: data,
        provider: data.provider,
        providerKey,
        accountReference: data.accountNumberLast4,
        amountDue: toAmount(data.amountDue),
        currency: data.currency,
        dueDate: data.dueDate,
        issueDate: data.issueDate,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        statementBalance: toAmount(data.statementBalance),
        minimumPayment: toAmount(data.minimumPayment),
        isDirectDebit: data.isDirectDebit,
        fingerprint,
        contentHash,
        duplicateOfId: duplicate?.id ?? null,
        reviewStatus: reviewStatusFor(data),
        updatedAt: new Date(),
      })
      .where(eq(billDocuments.id, documentId))
      .returning();

    if (stored.reviewStatus === 'pending_review') {
      const target = shouldAutoApply(
        { documentType: stored.documentType, amountCents, dueDate: stored.dueDate, duplicateOfId: stored.duplicateOfId, confidence: data.confidence },
        await matchSuggestions(stored),
      );
      if (target) {
        const applied = await applyBillDocument(stored, { action: 'match', subscriptionId: target }, stored.userId, { auto: true });
        submitLogEvent('bill-document', 'Bill filed automatically', correlationId, { documentId, subscriptionId: target });
        return applied;
      }
    }
    return stored;
  } catch (error) {
    submitLogEvent('bill-document', `Bill processing failed: ${error instanceof Error ? error.name : 'Unknown error'}`, correlationId, { documentId }, true);
    return fail(describeBillError(error));
  }
}

export type ApplyAction =
  | { action: 'match'; subscriptionId: string; amount?: 'due' | 'minimum' }
  | { action: 'new_bill'; name?: string; billingFrequency?: string }
  | { action: 'one_off'; label?: string }
  | { action: 'dismiss' };

/** The day the bill's money goes: its due date, else its date, else today. */
function billDay(document: BillDocument): string {
  return document.dueDate ?? document.issueDate ?? localToday();
}

function chosenAmount(document: BillDocument, choice: 'due' | 'minimum' | undefined): string | null {
  if (choice === 'minimum' && document.minimumPayment) return document.minimumPayment;
  return document.amountDue ?? document.statementBalance;
}

/**
 * File a document. Callers check access first. Matching an existing bill sets that cycle's amount
 * and due date (amount source 'bill') and saves the document's provider key on the bill, so the
 * next bill from the same provider can be filed without asking.
 */
export async function applyBillDocument(
  document: BillDocument,
  action: ApplyAction,
  actorUserId: string,
  options: { auto?: boolean } = {},
): Promise<BillDocument> {
  const finish = async (updates: Partial<typeof billDocuments.$inferInsert>) => {
    const [updated] = await db
      .update(billDocuments)
      .set({
        ...updates,
        autoApplied: Boolean(options.auto),
        reviewedByUserId: options.auto ? null : actorUserId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(billDocuments.id, document.id))
      .returning();
    return updated;
  };

  if (action.action === 'dismiss') {
    return finish({ reviewStatus: 'dismissed' });
  }

  const amount = chosenAmount(document, action.action === 'match' ? action.amount : undefined);
  if (amount === null) throw new BillApplyError('This bill has no amount to use. Enter it by hand in the plan instead.');
  const day = billDay(document);

  if (action.action === 'one_off') {
    const [entry] = await db
      .insert(planEntries)
      .values({
        userId: document.userId,
        householdId: document.householdId,
        date: day,
        label: action.label?.trim() || document.provider || document.fileName || 'Bill',
        amount,
        currency: document.currency ?? 'EUR',
        direction: 'out',
      })
      .returning();
    return finish({ reviewStatus: 'applied', appliedAs: 'one_off', entryId: entry.id });
  }

  let subscription: Subscription | null;
  if (action.action === 'new_bill') {
    const billingFrequency = action.billingFrequency ?? frequencyFromPeriod(document.periodStart, document.periodEnd);
    const startDate = new Date(`${day}T00:00:00.000Z`);
    const schedule = { startDate, billingFrequency, billingDay: startDate.getUTCDate(), customFrequencyDays: null, endDate: null };
    [subscription] = await db
      .insert(subscriptions)
      .values({
        userId: document.userId,
        householdId: document.householdId,
        name: action.name?.trim() || document.provider || 'Bill',
        amount,
        currency: document.currency ?? 'EUR',
        ...schedule,
        nextBillingDate: SubscriptionService.computeNextBillingDate(schedule),
        kind: 'bill',
        amountType: 'variable',
        paymentMethod: document.isDirectDebit ? 'direct_debit' : null,
        providerKey: document.providerKey,
        accountReference: document.accountReference,
        category: document.documentType === 'credit_card_statement' ? 'Credit card' : 'Utilities',
      })
      .returning();
    await SubscriptionService.generateExpectedPayments(subscription.id);
  } else {
    subscription = await SubscriptionService.getById(action.subscriptionId);
    if (!subscription) throw new BillApplyError('That bill no longer exists.');
    await db
      .update(subscriptions)
      .set({
        providerKey: document.providerKey ?? subscription.providerKey,
        accountReference: subscription.accountReference ?? document.accountReference,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));
  }

  const cycle = SubscriptionService.nearestCycle(subscription, day);
  const occurrence = cycle ? await SubscriptionService.findOrCreateOccurrence(subscription, cycle) : null;
  if (!occurrence) throw new BillApplyError("Couldn't find a billing date for this bill. Check the bill's schedule.");

  const payment = await SubscriptionService.applyPaymentChange(
    occurrence,
    { expectedAmount: amount, dueDate: document.dueDate ?? undefined },
    actorUserId,
    undefined,
    { amountSource: 'bill' },
  );

  return finish({
    reviewStatus: 'applied',
    appliedAs: action.action === 'new_bill' ? 'new_bill' : 'bill',
    subscriptionId: subscription.id,
    paymentId: payment.id,
  });
}

/** An expected reason a document can't be filed; the route answers 400 with the message. */
export class BillApplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BillApplyError';
  }
}
