import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { receipts, receiptItems } from '@/lib/db/schema';
import { getAuthenticatedUser, requireAdmin } from '@/lib/auth-helpers';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { del } from '@vercel/blob';
import { receiptsBlobToken } from '@/lib/storage/receipt-blob';

export const runtime = 'nodejs';

/**
 * DELETE /api/admin/receipts/[id]
 * Admin can delete any user's receipt (soft delete + optional blob cleanup)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  const { id: receiptId } = await params;

  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // Check if user is admin
    const adminCheck = await requireAdmin(user, correlationId);
    if (adminCheck) return adminCheck;

    // Get the receipt
    const [receipt] = await db
      .select()
      .from(receipts)
      .where(eq(receipts.id, receiptId))
      .limit(1);

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 },
      );
    }

    // Check if we should also delete the blob
    const { searchParams } = new URL(req.url);
    const deleteBlob = searchParams.get('deleteBlob') === 'true';

    // Soft delete the receipt
    await db
      .update(receipts)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(receipts.id, receiptId));

    submitLogEvent('admin', `Admin soft-deleted receipt ${receiptId}`, correlationId, {
      adminId: user.id,
      receiptId,
      receiptOwnerId: receipt.userId,
      deleteBlob,
    });

    // Optionally delete the blob
    if (deleteBlob && receipt.imageUrl) {
      try {
        await del(receipt.imageUrl, { token: receiptsBlobToken() });
        submitLogEvent('admin', `Admin deleted blob for receipt ${receiptId}`, correlationId, {
          adminId: user.id,
          receiptId,
          imageUrl: receipt.imageUrl,
        });
      } catch (blobError) {
        // Log but don't fail - the receipt is already soft deleted
        submitLogEvent('admin', `Failed to delete blob for receipt ${receiptId}: ${blobError instanceof Error ? blobError.message : 'Unknown error'}`, correlationId, {
          adminId: user.id,
          receiptId,
          imageUrl: receipt.imageUrl,
        }, true);
      }
    }

    return NextResponse.json({
      success: true,
      receiptId,
      blobDeleted: deleteBlob,
    });
  } catch (error) {
    submitLogEvent('admin', `Error deleting receipt: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { receiptId }, true);
    return NextResponse.json(
      { error: 'Failed to delete receipt' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/receipts/[id]/hard-delete
 * Admin can permanently delete a receipt and its blob
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  const { id: receiptId } = await params;

  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // Check if user is admin
    const adminCheck = await requireAdmin(user, correlationId);
    if (adminCheck) return adminCheck;

    // Get the receipt (including soft-deleted)
    const [receipt] = await db
      .select()
      .from(receipts)
      .where(eq(receipts.id, receiptId))
      .limit(1);

    if (!receipt) {
      return NextResponse.json(
        { error: 'Receipt not found' },
        { status: 404 },
      );
    }

    // Delete the blob first
    if (receipt.imageUrl) {
      try {
        await del(receipt.imageUrl, { token: receiptsBlobToken() });
        submitLogEvent('admin', `Admin deleted blob for receipt ${receiptId}`, correlationId, {
          adminId: user.id,
          receiptId,
          imageUrl: receipt.imageUrl,
        });
      } catch (blobError) {
        submitLogEvent('admin', `Failed to delete blob for receipt ${receiptId}: ${blobError instanceof Error ? blobError.message : 'Unknown error'}`, correlationId, {
          adminId: user.id,
          receiptId,
          imageUrl: receipt.imageUrl,
        }, true);
        // Continue with DB deletion even if blob delete fails
      }
    }

    // Delete receipt items first (cascade should handle this, but being explicit)
    await db
      .delete(receiptItems)
      .where(eq(receiptItems.receiptId, receiptId));

    // Hard delete the receipt from database
    await db
      .delete(receipts)
      .where(eq(receipts.id, receiptId));

    submitLogEvent('admin', `Admin hard-deleted receipt ${receiptId}`, correlationId, {
      adminId: user.id,
      receiptId,
      receiptOwnerId: receipt.userId,
    });

    return NextResponse.json({
      success: true,
      receiptId,
      permanentlyDeleted: true,
    });
  } catch (error) {
    submitLogEvent('admin', `Error hard-deleting receipt: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { receiptId }, true);
    return NextResponse.json(
      { error: 'Failed to permanently delete receipt' },
      { status: 500 },
    );
  }
}
