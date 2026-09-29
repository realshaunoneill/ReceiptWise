import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, requireSubscription, requireNoPendingDeletion } from '@/lib/auth-helpers';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { randomUUID } from 'crypto';
import { processReceipt } from '@/lib/receipt-processing';

export const runtime = 'nodejs';
// Image fetch (≤15s) plus the vision call (≤50s, retries included) plus the database writes.
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // Check subscription for receipt processing
    const subCheck = await requireSubscription(user);
    if (subCheck) return subCheck;

    const deletionCheck = requireNoPendingDeletion(user);
    if (deletionCheck) return deletionCheck;

    const body = await req.json();
    const { receiptId } = body;

    if (!receiptId || typeof receiptId !== 'string') {
      submitLogEvent('receipt-error', 'No receiptId provided to process endpoint', correlationId, {
        userId: user.id,
      }, true);
      return NextResponse.json(
        { error: 'Receipt ID is required' },
        { status: 400 },
      );
    }

    submitLogEvent('receipt-process-start', 'Starting receipt processing', correlationId, {
      receiptId,
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    const result = await processReceipt(receiptId, user.id, correlationId);

    if (!result.ok) {
      return NextResponse.json(
        { error: 'Failed to process receipt', message: result.message, receiptId },
        { status: result.status },
      );
    }

    const { receipt, items, ocrData } = result;

    const responseItems = items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.totalPrice,
      category: item.category,
      description: item.description,
    }));

    return NextResponse.json({
      success: true,
      receipt: {
        id: receipt.id,
        merchantName: receipt.merchantName,
        totalAmount: receipt.totalAmount,
        currency: receipt.currency,
        category: receipt.category,
        location: receipt.location,
        transactionDate: receipt.transactionDate,
        tax: receipt.tax,
        serviceCharge: receipt.serviceCharge,
        subtotal: receipt.subtotal,
        receiptNumber: receipt.receiptNumber,
        paymentMethod: receipt.paymentMethod,
        imageUrl: receipt.imageUrl,
        items: responseItems,
        itemCount: responseItems.length,
      },
      extractedData: {
        ...ocrData,
        items: responseItems,
        itemCount: responseItems.length,
      },
    });
  } catch (error) {
    submitLogEvent('receipt-error', `Receipt processing error: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, { error: error instanceof Error ? error.stack : undefined }, true);
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
