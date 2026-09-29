import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { receipts, receiptItems, insightsCache } from '@/lib/db/schema';
import { getAuthenticatedUser, requireSubscription, requireHouseholdMembership } from '@/lib/auth-helpers';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { randomUUID } from 'crypto';
import { parseBoundedInt, parseMonths, receiptScope, windowStart } from '@/lib/utils/insights-params';
import { DEFAULT_CURRENCY } from '@/lib/utils/currency';

export const runtime = 'nodejs';

/**
 * GET /api/receipts/items/top
 * Get top purchased items by frequency or spending
 * Query params:
 * - householdId: string (optional) - Filter by household
 * - months: number (optional, default: 12) - Number of months to look back
 * - limit: number (optional, default: 20) - Number of items to return
 * - sortBy: 'frequency' | 'spending' (optional, default: 'frequency')
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
    const householdId = searchParams.get('householdId');
    const months = parseMonths(searchParams.get('months'), 12);
    const limit = parseBoundedInt(searchParams.get('limit'), 20, 1, 50);
    const sortBy = searchParams.get('sortBy') === 'spending' ? 'spending' : 'frequency';

    // If householdId is provided, verify user is a member
    if (householdId) {
      const membershipCheck = await requireHouseholdMembership(householdId, user.id, correlationId);
      if (membershipCheck) return membershipCheck; // Returns error response if not a member
    }

    // Create cache key from query parameters
    const cacheKey = `months:${months}|limit:${limit}|sort:${sortBy}|household:${householdId || 'null'}`;

    // Check cache first
    const cachedResult = await db
      .select()
      .from(insightsCache)
      .where(
        and(
          eq(insightsCache.userId, user.id),
          eq(insightsCache.cacheType, 'top_items'),
          eq(insightsCache.cacheKey, cacheKey),
          gte(insightsCache.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (cachedResult.length > 0) {
      submitLogEvent('receipt', 'Returning cached top items', correlationId, {
        userId: user.id,
        householdId,
        months,
        sortBy,
        cacheAge: Date.now() - cachedResult[0].createdAt.getTime(),
      });
      return NextResponse.json(cachedResult[0].data);
    }

    // Calculate date range
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    submitLogEvent('receipt', 'Fetching top items', correlationId, {
      userId: user.id,
      householdId,
      months,
      sortBy,
    });

    // Get all receipt items with their receipt details
    const items = await db
      .select({
        itemName: receiptItems.name,
        quantity: receiptItems.quantity,
        totalPrice: receiptItems.totalPrice,
        unitPrice: receiptItems.unitPrice,
        category: receiptItems.category,
        merchantName: receipts.merchantName,
        transactionDate: receipts.transactionDate,
        currency: receipts.currency,
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
        ),
      )
      .orderBy(desc(receipts.transactionDate));

    // Aggregate items
    const itemMap = new Map<string, {
      name: string;
      count: number;
      totalSpent: number;
      totalQuantity: number;
      averagePrice: number;
      category: string | null;
      merchants: Set<string>;
      lastPurchased: string;
      currency: string;
    }>();

    items.forEach((item) => {
      const price = parseFloat(item.totalPrice || item.unitPrice || '0');
      const qty = parseFloat(item.quantity || '1');

      // Normalize item name (case-insensitive grouping)
      const normalizedName = item.itemName.toLowerCase().trim();

      if (!itemMap.has(normalizedName)) {
        itemMap.set(normalizedName, {
          name: item.itemName, // Keep original casing
          count: 0,
          totalSpent: 0,
          totalQuantity: 0,
          averagePrice: 0,
          category: item.category,
          merchants: new Set(),
          lastPurchased: item.transactionDate || new Date().toISOString().split('T')[0],
          currency: item.currency || user.currency || DEFAULT_CURRENCY,
        });
      }

      const itemData = itemMap.get(normalizedName)!;
      itemData.count += 1;
      itemData.totalSpent += price;
      itemData.totalQuantity += qty;
      itemData.merchants.add(item.merchantName || 'Unknown');

      // Update last purchased if more recent
      if (item.transactionDate && item.transactionDate > itemData.lastPurchased) {
        itemData.lastPurchased = item.transactionDate;
      }
    });

    // Calculate averages and convert to array
    const itemsArray = Array.from(itemMap.values()).map((item) => ({
      name: item.name,
      count: item.count,
      totalSpent: parseFloat(item.totalSpent.toFixed(2)),
      totalQuantity: parseFloat(item.totalQuantity.toFixed(2)),
      averagePrice: parseFloat((item.totalSpent / item.count).toFixed(2)),
      category: item.category,
      merchantCount: item.merchants.size,
      merchants: Array.from(item.merchants),
      lastPurchased: item.lastPurchased,
      currency: item.currency,
    }));

    // Sort based on preference
    const sortedItems = itemsArray.sort((a, b) => {
      if (sortBy === 'spending') {
        return b.totalSpent - a.totalSpent;
      }
      return b.count - a.count; // Default: frequency
    });

    // Limit results
    const topItems = sortedItems.slice(0, limit);

    // Calculate summary statistics
    const totalUniqueItems = itemsArray.length;
    const totalPurchases = itemsArray.reduce((sum, item) => sum + item.count, 0);
    const totalSpent = itemsArray.reduce((sum, item) => sum + item.totalSpent, 0);

    submitLogEvent('receipt', 'Top items fetched successfully', correlationId, {
      userId: user.id,
      uniqueItems: totalUniqueItems,
      totalPurchases,
    });

    const responseData = {
      topItems,
      summary: {
        totalUniqueItems,
        totalPurchases,
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        currency: topItems[0]?.currency || user.currency || DEFAULT_CURRENCY,
        period: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          months,
        },
      },
      sortBy,
    };

    // Store in cache for 24 hours
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    try {
      await db
        .insert(insightsCache)
        .values({
          userId: user.id,
          householdId: householdId || null,
          cacheType: 'top_items',
          cacheKey,
          data: responseData,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: [insightsCache.userId, insightsCache.cacheType, insightsCache.cacheKey],
          set: {
            data: responseData,
            expiresAt,
            createdAt: new Date(),
          },
        });
    } catch (cacheError) {
      // Log but don't fail the request if caching fails
      submitLogEvent('receipt-error', `Failed to cache top items: ${cacheError instanceof Error ? cacheError.message : 'Unknown error'}`, correlationId, {}, true);
    }

    return NextResponse.json(responseData);
  } catch (error) {
    submitLogEvent('receipt-error', `Error fetching top items: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to fetch top items' },
      { status: 500 },
    );
  }
}
