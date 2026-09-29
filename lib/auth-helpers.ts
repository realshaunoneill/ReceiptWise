import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { UserService } from '@/lib/services/user-service';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { householdUsers } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { User, Receipt } from '@/lib/db/schema';
import type { ReceiptWithItems } from '@/lib/types/api-responses';

/**
 * Get the user's primary, verified email from Clerk.
 *
 * `users.email` is used as an identity key — invitations are matched on it, and Stripe customers
 * are re-associated by it — so it must only ever hold an address Clerk has verified. It is
 * lower-cased so that matching an invitation typed as "Megan@Gmail.com" works.
 */
export async function getClerkUserEmail(clerkId: string, correlationId?: CorrelationId): Promise<string | null> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkId);
    const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
    const verified = [primary, ...user.emailAddresses].find(
      (e) => e && e.verification?.status === 'verified',
    );
    return verified?.emailAddress.trim().toLowerCase() ?? null;
  } catch (error) {
    submitLogEvent('auth', `Error fetching Clerk user: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId || randomUUID() as CorrelationId, { clerkId }, true);
    return null;
  }
}

/**
 * Get or create authenticated user from database
 * Returns user object or NextResponse error
 */
export async function getAuthenticatedUser(correlationId?: CorrelationId) {
  const cid = correlationId || randomUUID() as CorrelationId;
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const email = await getClerkUserEmail(clerkId, cid);
  if (!email) {
    return NextResponse.json({ error: 'User email not found' }, { status: 400 });
  }

  try {
    const user = await UserService.getOrCreateUser(clerkId, email);

    // Check if user is blocked
    if (user.isBlocked) {
      submitLogEvent('auth', `Blocked user attempted to access: ${user.email}`, cid, { userId: user.id, blockedReason: user.blockedReason });
      return NextResponse.json(
        {
          error: 'Your account has been suspended. Please contact support.',
          blockedReason: user.blockedReason || undefined,
        },
        { status: 403 },
      );
    }

    return { user, clerkId, email, correlationId: cid };
  } catch (error) {
    submitLogEvent('auth', `Error getting/creating user: ${error instanceof Error ? error.message : 'Unknown error'}`, cid, { clerkId }, true);
    return NextResponse.json({ error: 'Failed to authenticate user' }, { status: 500 });
  }
}

/**
 * Check if user has an active subscription
 * Returns null if subscribed, or NextResponse error if not
 */
export async function requireSubscription(userOrResult: { user: User } | User | NextResponse) {
  // If it's already a NextResponse error, return it
  if (userOrResult instanceof NextResponse) {
    return userOrResult;
  }

  const user = 'user' in userOrResult ? userOrResult.user : userOrResult;

  const skipSubscriptionCheck = process.env.SKIP_SUBSCRIPTION_CHECK === 'true';

  if (!skipSubscriptionCheck && !user.subscribed) {
    return NextResponse.json(
      { error: 'Active subscription required' },
      { status: 403 },
    );
  }

  return null;
}

/**
 * Reject requests from accounts inside their 24h deletion window.
 *
 * Deliberately NOT part of getAuthenticatedUser: /api/users/me must keep working so the
 * settings page can render the "deletion scheduled" banner, and /api/users/cancel-deletion
 * must keep working so the user isn't trapped. Apply this only to endpoints that create
 * data or incur AI cost.
 *
 * Returns null if the account is not pending deletion, or a NextResponse error if it is.
 */
export function requireNoPendingDeletion(user: User) {
  if (!user.deletionScheduledAt) {
    return null;
  }

  return NextResponse.json(
    {
      error: 'Your account is scheduled for deletion. Cancel the deletion in Settings to continue using ReceiptWise.',
      deletionScheduledAt: user.deletionScheduledAt,
    },
    { status: 403 },
  );
}

/**
 * Require admin privileges
 * Returns null if admin, or NextResponse error if not
 */
export async function requireAdmin(user: User, correlationId: CorrelationId) {
  const isAdmin = await UserService.isAdmin(user.id);
  if (!isAdmin) {
    submitLogEvent('admin', 'Unauthorized admin access attempt', correlationId, { userId: user.id }, true);
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Check if user is member of household
 * Returns membership record or null
 */
export async function getHouseholdMembership(householdId: string, userId: string) {
  const [membership] = await db
    .select()
    .from(householdUsers)
    .where(
      and(
        eq(householdUsers.householdId, householdId),
        eq(householdUsers.userId, userId),
      ),
    )
    .limit(1);
  return membership || null;
}

/**
 * Require household membership
 * Returns null if member, or NextResponse error if not
 */
export async function requireHouseholdMembership(
  householdId: string,
  userId: string,
  correlationId: CorrelationId,
) {
  const membership = await getHouseholdMembership(householdId, userId);
  if (!membership) {
    submitLogEvent('household', 'Unauthorized household access attempt', correlationId, { userId, householdId }, true);
    return NextResponse.json(
      { error: 'Not a member of this household' },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Require READ access to a receipt: the owner, a member of the household the receipt is
 * assigned to, or an admin.
 *
 * Household members are included deliberately. /api/receipts already lists a household's
 * receipts to every member, so gating the detail fetch on ownership alone made a shared
 * receipt visible in the list but 403 on open — the detail modal then silently fell back to
 * stale list data, and retry/refresh appeared to do nothing.
 *
 * This is read-only permission. Mutations stay owner-only — see requireReceiptOwner.
 *
 * Returns null if authorized, or a NextResponse error if not.
 */
export async function requireReceiptAccess(
  receipt: Receipt,
  user: User,
  correlationId: CorrelationId,
) {
  // Owner is the common case; resolve it without extra queries.
  if (receipt.userId === user.id) {
    return null;
  }

  if (receipt.householdId) {
    const membership = await getHouseholdMembership(receipt.householdId, user.id);
    if (membership) {
      return null;
    }
  }

  if (await UserService.isAdmin(user.id)) {
    return null;
  }

  submitLogEvent('receipt', 'Unauthorized receipt access attempt', correlationId, { userId: user.id, receiptId: receipt.id }, true);
  return NextResponse.json(
    { error: "You don't have permission to access this receipt" },
    { status: 403 },
  );
}

/**
 * Require OWNERSHIP of a receipt (or admin) for destructive or mutating operations.
 *
 * Kept separate from requireReceiptAccess so that widening read access to household members
 * never silently grants them the ability to delete each other's receipts.
 *
 * Returns null if authorized, or a NextResponse error if not.
 */
export async function requireReceiptOwner(
  receipt: Receipt,
  user: User,
  correlationId: CorrelationId,
) {
  if (receipt.userId === user.id) {
    return null;
  }

  if (await UserService.isAdmin(user.id)) {
    return null;
  }

  submitLogEvent('receipt', 'Unauthorized receipt modification attempt', correlationId, { userId: user.id, receiptId: receipt.id }, true);
  return NextResponse.json(
    { error: "You don't have permission to modify this receipt" },
    { status: 403 },
  );
}

/**
 * Filter receipt data for non-subscribed users
 * Removes premium features like line items, OCR data, detailed analytics
 */
export function filterReceiptForSubscription(receipt: Receipt | ReceiptWithItems, isSubscribed: boolean) {
  if (isSubscribed) {
    return receipt;
  }

  // For non-subscribed users, only return basic receipt info
  const filtered: Record<string, unknown> = {
    id: receipt.id,
    userId: receipt.userId,
    householdId: receipt.householdId,
    imageUrl: receipt.imageUrl,
    merchantName: receipt.merchantName,
    totalAmount: receipt.totalAmount,
    currency: receipt.currency,
    transactionDate: receipt.transactionDate,
    category: receipt.category,
    processingStatus: receipt.processingStatus,
    // Kept so a failed receipt still says why, and a non-receipt image is still flagged.
    processingError: receipt.processingError,
    isReceipt: receipt.isReceipt,
    createdAt: receipt.createdAt,
    updatedAt: receipt.updatedAt,
  };

  // Add submittedBy if it exists (only on ReceiptWithItems)
  if ('submittedBy' in receipt && receipt.submittedBy !== undefined) {
    filtered.submittedBy = receipt.submittedBy;
  }

  return filtered;
}

/**
 * Filter multiple receipts for non-subscribed users
 */
export function filterReceiptsForSubscription(receipts: ReceiptWithItems[], isSubscribed: boolean) {
  if (isSubscribed) {
    return receipts;
  }
  return receipts.map(receipt => filterReceiptForSubscription(receipt, false));
}

