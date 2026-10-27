import { randomBytes } from 'crypto';
import { put } from '@vercel/blob';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { and, count, eq, gte, inArray, lt, or } from 'drizzle-orm';
import PostalMime from 'postal-mime';
import { db } from '@/lib/db';
import { billDocuments, inboundEmails, receipts, users, type BillDocument, type User } from '@/lib/db/schema';
import { checkBillDocumentLimit } from '@/lib/bill-rate-limit';
import { isFeatureEnabled } from '@/lib/features';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { checkReceiptCreationLimit } from '@/lib/receipt-rate-limit';
import * as push from '@/lib/push/events';
import { processReceipt } from '@/lib/receipt-processing';
import { processBillDocument } from '@/lib/services/bill-document-service';
import { getFinanceEntitlements } from '@/lib/services/finance-access';
import { userForInboundToken } from '@/lib/services/inbound-address-service';
import { billsPrefix, putPrivate, readPrivate, readWriteToken } from '@/lib/storage/private-blob';
import { receiptsBlobToken } from '@/lib/storage/receipt-blob';
import { forwardingConfirmation, selectParts } from './parts';

/**
 * Forwarded email, as the Cloudflare Email Worker (workers/inbound-email) hands it over:
 *
 *   1. start: the Worker sends the recipient token and the message's key and size. The user is the
 *      token's owner (never the From header). The message is claimed once per user; the Worker gets
 *      a short-lived client token that can write only this message's raw file to the private store.
 *   2. The Worker uploads the raw message itself, so its size isn't capped by Vercel's 4.5 MB body.
 *   3. stored: the app reads it, picks the attachments (or the text), stores each as a bill
 *      document, and reads them. Receipt images go to Receipts instead.
 */

export const MAX_EMAIL_BYTES = 25 * 1024 * 1024;
/** A 'receiving' claim older than this was abandoned by its Worker run and can be taken over. */
const STALE_RECEIVING_MS = 2 * 60 * 1000;
const CLIENT_TOKEN_VALID_MS = 5 * 60 * 1000;
const DAILY_EMAIL_LIMIT = 50;

export type StartResult =
  | { action: 'store'; emailId: string; pathname: string; clientToken: string }
  | { action: 'drop' }
  | { action: 'reject'; reason: string };

export async function startInboundEmail(input: {
  token: string;
  messageKey: string;
  sizeBytes: number;
  from: string | null;
  subject: string | null;
}, correlationId: CorrelationId): Promise<StartResult> {
  const user = await userForInboundToken(input.token);
  if (!user) return { action: 'reject', reason: 'Unknown address' };
  const refusal = await refusalFor(user);
  if (refusal) return { action: 'reject', reason: refusal };
  if (input.sizeBytes > MAX_EMAIL_BYTES) return { action: 'reject', reason: 'Message too large' };

  const [{ today }] = await db
    .select({ today: count() })
    .from(inboundEmails)
    .where(and(eq(inboundEmails.userId, user.id), gte(inboundEmails.receivedAt, new Date(Date.now() - 24 * 60 * 60 * 1000))));
  if (today >= DAILY_EMAIL_LIMIT) return { action: 'reject', reason: 'Too many emails today' };

  const fields = {
    userId: user.id,
    messageKey: input.messageKey.slice(0, 500),
    fromAddress: input.from?.slice(0, 320) ?? null,
    subject: input.subject?.slice(0, 300) ?? null,
    sizeBytes: input.sizeBytes,
    status: 'receiving',
  };
  let [email] = await db.insert(inboundEmails).values(fields).onConflictDoNothing().returning();
  if (!email) {
    // Delivered before. Carry on only if that delivery's Worker run died before handing it over.
    [email] = await db
      .update(inboundEmails)
      .set({ updatedAt: new Date() })
      .where(and(
        eq(inboundEmails.userId, user.id),
        eq(inboundEmails.messageKey, fields.messageKey),
        eq(inboundEmails.status, 'receiving'),
        lt(inboundEmails.updatedAt, new Date(Date.now() - STALE_RECEIVING_MS)),
      ))
      .returning();
    if (!email) return { action: 'drop' };
  }

  const pathname = `${billsPrefix(user.id)}email/${email.id}/raw.eml`;
  await db.update(inboundEmails).set({ rawBlobPathname: pathname, updatedAt: new Date() }).where(eq(inboundEmails.id, email.id));
  const clientToken = await generateClientTokenFromReadWriteToken({
    token: readWriteToken(),
    pathname,
    maximumSizeInBytes: MAX_EMAIL_BYTES,
    validUntil: Date.now() + CLIENT_TOKEN_VALID_MS,
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  submitLogEvent('inbound-email', 'Email accepted', correlationId, { emailId: email.id, userId: user.id, sizeBytes: input.sizeBytes });
  return { action: 'store', emailId: email.id, pathname, clientToken };
}

/** Why mail for this user is refused, or null: the flag, a blocked or closing account, no Premium. */
async function refusalFor(user: User): Promise<string | null> {
  if (user.isBlocked || user.deletionScheduledAt) return 'Account unavailable';
  if (!isFeatureEnabled(user, 'bills')) return 'Not available';
  const entitlements = await getFinanceEntitlements(user);
  if (!entitlements.personal && entitlements.householdIds.length === 0) return 'Premium required';
  return null;
}

/** The Worker has uploaded the raw message. Returns false if the email isn't waiting for it. */
export async function markInboundEmailStored(emailId: string): Promise<boolean> {
  const [stored] = await db
    .update(inboundEmails)
    .set({ status: 'stored', updatedAt: new Date() })
    .where(and(eq(inboundEmails.id, emailId), eq(inboundEmails.status, 'receiving')))
    .returning({ id: inboundEmails.id });
  return Boolean(stored);
}

const RECEIPT_IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * A receipt image that arrived by email belongs in Receipts: copy it to the receipts store, create
 * the receipt (in the user's default household, as uploads are) and read it. Only for users whose
 * own Premium covers receipts.
 */
async function routeToReceipts(document: BillDocument, user: User, bytes: Buffer, correlationId: CorrelationId): Promise<void> {
  const extension = RECEIPT_IMAGE_TYPES[document.mimeType];
  if (!extension || !user.subscribed) return;
  if ((await checkReceiptCreationLimit(user.id)).limited) return;

  const environment = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
  const blob = await put(`${environment}/receipts/${user.id}/email-${randomBytes(8).toString('hex')}.${extension}`, bytes, {
    access: 'public',
    contentType: document.mimeType,
    addRandomSuffix: true,
    token: receiptsBlobToken(),
  });
  const [receipt] = await db
    .insert(receipts)
    .values({ userId: user.id, householdId: user.defaultHouseholdId ?? null, imageUrl: blob.url, processingStatus: 'pending', source: 'email' })
    .returning();
  await db
    .update(billDocuments)
    .set({ reviewStatus: 'applied', appliedAs: 'receipt', receiptId: receipt.id, reviewedAt: new Date(), autoApplied: true, updatedAt: new Date() })
    .where(eq(billDocuments.id, document.id));
  const result = await processReceipt(receipt.id, user.id, correlationId);
  if (result.ok) push.receiptProcessed(result.receipt, { ok: true, itemCount: result.items.length }, 'email', correlationId);
  else if (result.reason === 'failed') push.receiptProcessed(receipt, { ok: false }, 'email', correlationId);
}

/**
 * Read a stored email and turn it into bill documents. Safe to run twice: documents are keyed by
 * (email, part), and already-read ones are not read again.
 */
export async function processInboundEmail(emailId: string, correlationId: CorrelationId): Promise<void> {
  const [email] = await db
    .select()
    .from(inboundEmails)
    .where(and(eq(inboundEmails.id, emailId), inArray(inboundEmails.status, ['stored', 'failed'])))
    .limit(1);
  if (!email || !email.rawBlobPathname) return;

  const finish = (status: string, extra: Partial<typeof inboundEmails.$inferInsert> = {}) =>
    db.update(inboundEmails).set({ status, processedAt: new Date(), updatedAt: new Date(), ...extra }).where(eq(inboundEmails.id, emailId));

  try {
    const raw = await readPrivate(email.rawBlobPathname);
    if (!raw) return void (await finish('failed', { error: 'The message could not be read back' }));
    const parsed = await PostalMime.parse(raw);

    const confirmation = forwardingConfirmation(parsed);
    if (confirmation) {
      return void (await finish('forwarding_confirmation', { confirmationCode: confirmation.code, confirmationUrl: confirmation.url }));
    }

    const { parts, text } = selectParts(parsed);
    const toStore = parts.length > 0
      ? parts.map((part) => ({ ...part, bytes: Buffer.from(part.bytes) }))
      : text
        ? [{ index: 0, fileName: 'email.txt', mimeType: 'text/plain', bytes: Buffer.from(`Subject: ${parsed.subject ?? ''}\n\n${text}`, 'utf8') }]
        : [];
    if (toStore.length === 0) return void (await finish('no_content', { partCount: 0 }));

    const [user] = await db.select().from(users).where(eq(users.id, email.userId)).limit(1);
    if (!user) return;
    const limit = await checkBillDocumentLimit(user.id, toStore.length);
    if (limit.limited) return void (await finish('rejected_limit', { error: limit.message, partCount: toStore.length }));

    // Personal by default, like uploads; someone without their own Premium files into the household that covers them.
    const entitlements = await getFinanceEntitlements(user);
    const householdId = entitlements.personal ? null : entitlements.householdIds[0] ?? null;

    for (const part of toStore) {
      const safeName = part.fileName.replace(/[^\w.\-]+/g, '_').slice(-80) || `part-${part.index}`;
      const pathname = `${billsPrefix(user.id)}email/${emailId}/${part.index}-${safeName}`;
      await putPrivate(pathname, part.bytes, part.mimeType);
      await db
        .insert(billDocuments)
        .values({
          userId: user.id,
          householdId,
          source: 'email',
          blobPathname: pathname,
          mimeType: part.mimeType,
          fileName: part.mimeType === 'text/plain' ? (parsed.subject?.slice(0, 120) || 'Email') : part.fileName,
          sizeBytes: part.bytes.length,
          inboundEmailId: emailId,
          partIndex: part.index,
        })
        .onConflictDoNothing();
    }

    const documents = await db
      .select()
      .from(billDocuments)
      .where(and(eq(billDocuments.inboundEmailId, emailId), or(eq(billDocuments.processingStatus, 'pending'), eq(billDocuments.processingStatus, 'failed'))));
    for (const document of documents) {
      const read = await processBillDocument(document.id, correlationId);
      if (read?.documentType === 'receipt' && read.reviewStatus === 'not_a_bill') {
        const part = toStore.find((candidate) => candidate.index === read.partIndex);
        if (part) await routeToReceipts(read, user, part.bytes, correlationId);
      }
    }

    await finish('processed', { partCount: toStore.length, error: null });
    submitLogEvent('inbound-email', 'Email processed', correlationId, { emailId, parts: toStore.length });
  } catch (error) {
    submitLogEvent('inbound-email', `Email processing failed: ${error instanceof Error ? error.name : 'Unknown error'}`, correlationId, { emailId }, true);
    await finish('failed', { error: 'Something went wrong reading this email' });
  }
}
