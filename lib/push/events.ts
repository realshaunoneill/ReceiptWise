import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { type BillDocument, householdUsers, households, type Receipt, users } from '@/lib/db/schema';
import { type CorrelationId } from '@/lib/logging';
import { billFailed, billFiled, billNeedsDocument, billRead, inviteReceived, memberJoined, paymentFailed, receiptFailed, receiptRead, trialEnding } from './messages';
import { waitUntil } from '@vercel/functions';
import { submitLogEvent } from '@/lib/logging';
import { notifyLater } from './send';

/** Run an event's lookups after the response too, and never let them throw. */
export function later(work: Promise<unknown>): void {
  const safe = work.catch((error) => submitLogEvent('push', `Push event failed: ${error instanceof Error ? error.message : 'Unknown error'}`, null, {}, true));
  try {
    waitUntil(safe);
  } catch {
    // Outside a request: it still runs.
  }
}

/**
 * Where the rest of the code tells people things: one call per event, after the response, never
 * able to break what caused it (lib/push/send.ts). Which events notify, and for whom:
 */

/**
 * A receipt from the app, the extension or a forwarded email, read or not. Not one uploaded on
 * the website, or read again with Retry: the person is looking at it then.
 */
export function receiptProcessed(
  receipt: Pick<Receipt, 'id' | 'userId' | 'merchantName' | 'totalAmount' | 'currency'>,
  outcome: { ok: true; itemCount: number } | { ok: false },
  source: 'app' | 'extension' | 'email',
  correlationId: CorrelationId,
): void {
  notifyLater(
    receipt.userId,
    (prefs) => (outcome.ok ? receiptRead({ ...receipt, itemCount: outcome.itemCount }, prefs) : receiptFailed(receipt)),
    // A photo just taken in the app: the person is waiting for it, quiet hours or not.
    { refKey: `receipt:${receipt.id}`, triggeredByUser: source !== 'email', correlationId },
  );
}

/**
 * A bill brought in by the app, by email or moved from Receipts, read: ready to file, filed
 * automatically, needing its document, or not readable. Not a website upload (the person is on
 * the page), and not one that isn't a bill (a newsletter forwarded by a rule).
 */
export function billDocumentProcessed(document: BillDocument, correlationId: CorrelationId): void {
  if (document.source === 'upload' || document.deletedAt) return;
  const refKey = `bill-document:${document.id}`;
  const triggeredByUser = document.source !== 'email';
  if (document.processingStatus === 'failed') {
    notifyLater(document.userId, () => billFailed(document), { refKey, triggeredByUser, correlationId });
  } else if (document.reviewStatus === 'applied' && document.autoApplied) {
    notifyLater(document.userId, (prefs) => billFiled(document, prefs), { refKey, triggeredByUser, correlationId });
  } else if (document.reviewStatus === 'pending_review') {
    notifyLater(document.userId, (prefs) => billRead(document, prefs), { refKey, triggeredByUser, correlationId });
  } else if (document.reviewStatus === 'needs_document') {
    notifyLater(document.userId, () => billNeedsDocument(document), { refKey, triggeredByUser, correlationId });
  }
}

async function householdName(householdId: string): Promise<string> {
  const [household] = await db.select({ name: households.name }).from(households).where(eq(households.id, householdId)).limit(1);
  return household?.name ?? 'a household';
}

/** An invitation to someone who already has an account: they hear about it on their phone too. */
export async function invitationSent(invitation: { id: string; householdId: string; invitedEmail: string; invitedByUserId: string }, correlationId: CorrelationId | null = null): Promise<void> {
  const [invitee] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${invitation.invitedEmail.toLowerCase()}`).limit(1);
  if (!invitee) return;
  const [inviter] = await db.select({ email: users.email }).from(users).where(eq(users.id, invitation.invitedByUserId)).limit(1);
  const name = await householdName(invitation.householdId);
  notifyLater(invitee.id, () => inviteReceived({ householdName: name, invitedBy: inviter?.email ?? null }), { refKey: `invitation:${invitation.id}`, correlationId: correlationId ?? undefined });
}

/** Someone joined: the household's owners hear who. */
export async function memberAdded(householdId: string, memberUserId: string, correlationId: CorrelationId | null = null): Promise<void> {
  const [member] = await db.select({ email: users.email }).from(users).where(eq(users.id, memberUserId)).limit(1);
  const owners = await db
    .select({ userId: householdUsers.userId })
    .from(householdUsers)
    .where(and(eq(householdUsers.householdId, householdId), inArray(householdUsers.role, ['owner'])));
  const name = await householdName(householdId);
  for (const owner of owners) {
    if (owner.userId === memberUserId) continue;
    notifyLater(owner.userId, () => memberJoined({ householdName: name, who: member?.email ?? 'Someone' }), { refKey: `member:${householdId}:${memberUserId}`, correlationId: correlationId ?? undefined });
  }
}

/** Stripe's trial-ending and failed-payment events (the website's Premium). */
export function stripeBillingEvent(userId: string, event: { id: string; type: string; trialEnd?: number | null; invoiceId?: string | null }, correlationId: CorrelationId): void {
  if (event.type === 'customer.subscription.trial_will_end') {
    const endsOn = event.trialEnd ? new Date(event.trialEnd * 1000).toISOString().slice(0, 10) : null;
    notifyLater(userId, () => trialEnding({ endsOn }), { refKey: `stripe:${event.id}`, correlationId });
  } else if (event.type === 'invoice.payment_failed') {
    notifyLater(userId, () => paymentFailed(), { refKey: `stripe-invoice:${event.invoiceId ?? event.id}`, correlationId });
  }
}
