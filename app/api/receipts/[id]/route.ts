import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, requireReceiptAccess, requireReceiptOwner, filterReceiptForSubscription } from '@/lib/auth-helpers';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { getReceiptById, deleteReceipt } from '@/lib/receipt-scanner';
import { db } from '@/lib/db';
import { receipts, subscriptionPayments, subscriptions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { invalidateInsightsCache } from '@/lib/utils/cache-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = (request.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id: receiptId } = await params;

    const receipt = await getReceiptById(receiptId);

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 },
      );
    }

    // Owner, a member of the receipt's household, or an admin. Household members were getting a
    // 403 here for receipts the list endpoint had just shown them.
    const accessCheck = await requireReceiptAccess(receipt, user, correlationId);
    if (accessCheck) return accessCheck;

    // Fetch linked subscription if user is subscribed
    let linkedSubscription = null;
    if (user.subscribed) {
      const [payment] = await db
        .select({
          id: subscriptionPayments.id,
          subscriptionId: subscriptionPayments.subscriptionId,
          expectedDate: subscriptionPayments.expectedDate,
          expectedAmount: subscriptionPayments.expectedAmount,
          status: subscriptionPayments.status,
          subscription: {
            id: subscriptions.id,
            name: subscriptions.name,
            amount: subscriptions.amount,
            currency: subscriptions.currency,
            billingFrequency: subscriptions.billingFrequency,
            status: subscriptions.status,
            isBusinessExpense: subscriptions.isBusinessExpense,
          },
        })
        .from(subscriptionPayments)
        .innerJoin(subscriptions, eq(subscriptionPayments.subscriptionId, subscriptions.id))
        .where(
          and(
            eq(subscriptionPayments.receiptId, receiptId),
            eq(subscriptions.userId, user.id),
          ),
        )
        .limit(1);

      linkedSubscription = payment || null;
    }

    // Filter receipt data based on subscription status
    const filteredReceipt = filterReceiptForSubscription(receipt, user.subscribed);

    return NextResponse.json({
      ...filteredReceipt,
      linkedSubscription,
    });
  } catch (error) {
    console.error('Error fetching receipt:', error);

    submitLogEvent(
      'receipt-error',
      'Failed to fetch receipt',
      correlationId,
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      true,
    );

    return NextResponse.json(
      { error: 'Failed to fetch receipt' },
      { status: 500 },
    );
  }
}

// PATCH /api/receipts/[id] - Update receipt (e.g., business expense fields)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = (request.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id: receiptId } = await params;

    const receipt = await getReceiptById(receiptId);

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 },
      );
    }

    // Only receipt owner can update business expense fields
    if (receipt.userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - only receipt owner can update this receipt' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      isBusinessExpense,
      businessCategory,
      businessNotes,
      taxDeductible,
    } = body;

    // Validate types: a non-boolean isBusinessExpense used to reach Postgres and 500.
    const isOptionalBoolean = (v: unknown) => v === undefined || typeof v === 'boolean';
    const isOptionalText = (v: unknown, max: number) =>
      v === undefined || v === null || (typeof v === 'string' && v.length <= max);
    if (
      !isOptionalBoolean(isBusinessExpense) ||
      !isOptionalBoolean(taxDeductible) ||
      !isOptionalText(businessCategory, 100) ||
      !isOptionalText(businessNotes, 2000)
    ) {
      return NextResponse.json({ error: 'Invalid receipt update' }, { status: 400 });
    }

    // Build update object
    const updates: Partial<typeof receipts.$inferInsert> = {};

    if (isBusinessExpense !== undefined) updates.isBusinessExpense = isBusinessExpense;
    if (businessCategory !== undefined) updates.businessCategory = businessCategory;
    if (businessNotes !== undefined) updates.businessNotes = businessNotes;
    if (taxDeductible !== undefined) updates.taxDeductible = taxDeductible;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(filterReceiptForSubscription(receipt, user.subscribed));
    }
    updates.updatedAt = new Date();

    const [updatedReceipt] = await db
      .update(receipts)
      .set(updates)
      .where(eq(receipts.id, receiptId))
      .returning();

    // Invalidate insights cache when business expense status changes
    if (isBusinessExpense !== undefined || businessCategory !== undefined || taxDeductible !== undefined) {
      await invalidateInsightsCache(user.id, receipt.householdId, correlationId);
    }

    submitLogEvent(
      'receipt',
      `Updated receipt ${receiptId}`,
      correlationId,
      { receiptId, updates },
    );

    // Filter based on subscription status
    const filteredReceipt = filterReceiptForSubscription(updatedReceipt, user.subscribed);

    return NextResponse.json(filteredReceipt);
  } catch (error) {
    console.error('Error updating receipt:', error);

    submitLogEvent(
      'receipt-error',
      'Failed to update receipt',
      correlationId,
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      true,
    );

    return NextResponse.json(
      { error: 'Failed to update receipt' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = (request.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // Await params in Next.js 15+
    const { id: receiptId } = await params;

    // Get the receipt to verify ownership and log details
    const receipt = await getReceiptById(receiptId);

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 },
      );
    }

    // Deleting is owner-only (or admin): household members can read a shared receipt but
    // must not be able to delete each other's.
    const accessCheck = await requireReceiptOwner(receipt, user, correlationId);
    if (accessCheck) return accessCheck;

    // Soft delete the receipt using helper function
    const deleted = await deleteReceipt(receiptId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Failed to delete receipt' },
        { status: 500 },
      );
    }

    // Log the deletion
    submitLogEvent(
      'receipt',
      'Receipt soft deleted',
      correlationId,
      {
        receiptId,
        userId: user.id,
        merchantName: receipt.merchantName,
        totalAmount: receipt.totalAmount,
        deletedByAdmin: user.isAdmin && receipt.userId !== user.id,
        receiptOwnerId: receipt.userId,
      },
    );

    // Invalidate insights cache for this user
    await invalidateInsightsCache(user.id, receipt.householdId, correlationId);

    return NextResponse.json({
      success: true,
      message: 'Receipt deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting receipt:', error);

    // Get receiptId from params for error logging
    const { id: receiptId } = await params;

    submitLogEvent(
      'receipt-error',
      'Failed to delete receipt',
      correlationId,
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        receiptId,
      },
      true, // alert on error
    );

    return NextResponse.json(
      { error: 'Failed to delete receipt' },
      { status: 500 },
    );
  }
}
