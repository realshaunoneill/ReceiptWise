import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { receipts, receiptItems } from '@/lib/db/schema';
import { getAuthenticatedUser, requireSubscription, requireHouseholdMembership } from '@/lib/auth-helpers';
import { eq, and, gte, sql, desc, ilike } from 'drizzle-orm';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { randomUUID } from 'crypto';
import { parseBoundedInt, parseMonths, receiptScope, windowStart } from '@/lib/utils/insights-params';
import { DEFAULT_CURRENCY } from '@/lib/utils/currency';

export const runtime = 'nodejs';

/**
 * GET /api/receipts/items/history
 * Get purchase history for a specific item with receipt details
 * Query params:
 * - itemName: string (required) - Item name to search for
 * - householdId: string (optional) - Filter by household
 * - months: number (optional, default: 12) - Number of months to look back
 * - limit: number (optional, default: 10) - Number of purchases to return
 */
export async function GET(request: NextRequest) {
  const correlationId = (request.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // Check if a user is subscribed
    const subCheck = await requireSubscription(user);
    if (subCheck) return subCheck;

    const { searchParams } = new URL(request.url);
    const itemName = searchParams.get('itemName');
    const householdId = searchParams.get('householdId');
    const months = parseMonths(searchParams.get('months'), 12);
    const limit = parseBoundedInt(searchParams.get('limit'), 10, 1, 50);

    if (!itemName) {
      return NextResponse.json(
        { error: 'itemName parameter is required' },
        { status: 400 },
      );
    }

    // If householdId is provided, verify user is a member
    if (householdId) {
      const membershipCheck = await requireHouseholdMembership(householdId, user.id, correlationId);
      if (membershipCheck) return membershipCheck;
    }

    // Calculate date range
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    submitLogEvent('receipt', 'Fetching item purchase history', correlationId, {
      userId: user.id,
      itemName,
      householdId,
      months,
    });

    // Normalize search term for partial matching
    const normalizedSearch = itemName.toLowerCase().trim();
    const searchTerms = normalizedSearch.split(/\s+/).filter(w => w.length > 0);

    // Build search conditions for partial matching
    const searchConditions = searchTerms.map(term =>
      ilike(receiptItems.name, `%${term}%`),
    );

    // Get purchase history with receipt details
    const purchases = await db
      .select({
        receiptId: receipts.id,
        merchantName: receipts.merchantName,
        transactionDate: receipts.transactionDate,
        imageUrl: receipts.imageUrl,
        currency: receipts.currency,
        itemName: receiptItems.name,
        quantity: receiptItems.quantity,
        totalPrice: receiptItems.totalPrice,
        unitPrice: receiptItems.unitPrice,
        category: receiptItems.category,
      })
      .from(receiptItems)
      .innerJoin(receipts, eq(receiptItems.receiptId, receipts.id))
      .where(
        and(
          receiptScope(user.id, householdId),
          // Plain text comparison: transactionDate is 'YYYY-MM-DD', which sorts lexically. The
          // previous TO_DATE() threw for any malformed stored date and 500'd the whole route.
          gte(receipts.transactionDate, windowStart(months)),
          sql`${receipts.deletedAt} IS NULL`,
          // Match items where name contains all search terms
          searchConditions.length > 0
            ? and(...searchConditions)
            : ilike(receiptItems.name, `%${normalizedSearch}%`),
        ),
      )
      .orderBy(desc(receipts.transactionDate))
      .limit(limit);

    // Group by receipt to avoid duplicates if same item appears multiple times
    const receiptMap = new Map<string, {
      receiptId: string;
      merchant: string;
      date: string;
      imageUrl: string;
      currency: string;
      items: Array<{
        name: string;
        quantity: string;
        price: string;
      }>;
      totalPrice: number;
      totalQuantity: number;
    }>();

    purchases.forEach((purchase) => {
      const price = parseFloat(purchase.totalPrice || purchase.unitPrice || '0');
      const qty = parseFloat(purchase.quantity || '1');

      if (!receiptMap.has(purchase.receiptId)) {
        receiptMap.set(purchase.receiptId, {
          receiptId: purchase.receiptId,
          merchant: purchase.merchantName || 'Unknown Merchant',
          date: purchase.transactionDate || '',
          imageUrl: purchase.imageUrl,
          currency: purchase.currency || DEFAULT_CURRENCY,
          items: [],
          totalPrice: 0,
          totalQuantity: 0,
        });
      }

      const receipt = receiptMap.get(purchase.receiptId)!;
      receipt.items.push({
        name: purchase.itemName,
        quantity: purchase.quantity || '1',
        price: price.toFixed(2),
      });
      receipt.totalPrice += price;
      receipt.totalQuantity += qty;
    });

    // Convert to array format for response
    const recentPurchases = Array.from(receiptMap.values()).map((receipt) => ({
      receiptId: receipt.receiptId,
      merchant: receipt.merchant,
      date: receipt.date,
      imageUrl: receipt.imageUrl,
      currency: receipt.currency,
      quantity: receipt.totalQuantity.toString(),
      price: receipt.totalPrice.toFixed(2),
      itemCount: receipt.items.length,
      items: receipt.items,
    }));

    submitLogEvent('receipt', 'Item history fetched successfully', correlationId, {
      userId: user.id,
      itemName,
      purchaseCount: recentPurchases.length,
    });

    return NextResponse.json({
      itemName,
      purchases: recentPurchases,
      period: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        months,
      },
    });
  } catch (error) {
    submitLogEvent('receipt-error', `Error fetching item history: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to fetch item history' },
      { status: 500 },
    );
  }
}
