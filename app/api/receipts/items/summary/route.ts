import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { receipts, receiptItems, insightsCache } from '@/lib/db/schema';
import { getAuthenticatedUser, requireSubscription, requireHouseholdMembership } from '@/lib/auth-helpers';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { generateSpendingSummary } from '@/lib/openai';
import { randomUUID } from 'crypto';
import { parseMonths, receiptScope, windowStart } from '@/lib/utils/insights-params';
import { DEFAULT_CURRENCY } from '@/lib/utils/currency';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/receipts/items/summary
 * Get AI-powered summary of spending patterns based on receipt items
 * Query params:
 * - householdId: string (optional) - Filter by household
 * - months: number (optional, default: 3) - Number of months to analyze
 */
export async function GET(request: NextRequest) {
  const correlationId = (request.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user, email } = authResult;

    // Check if a user is subscribed
    const subCheck = await requireSubscription(user);
    if (subCheck) return subCheck;

    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('householdId');
    const months = parseMonths(searchParams.get('months'), 3);

    // If householdId is provided, verify user is a member
    if (householdId) {
      const membershipCheck = await requireHouseholdMembership(householdId, user.id, correlationId);
      if (membershipCheck) return membershipCheck; // Returns error response if not a member
    }

    // Create cache key from query parameters
    const cacheKey = `months:${months}|household:${householdId || 'null'}`;

    // Check cache first
    const cachedResult = await db
      .select()
      .from(insightsCache)
      .where(
        and(
          eq(insightsCache.userId, user.id),
          eq(insightsCache.cacheType, 'spending_summary'),
          eq(insightsCache.cacheKey, cacheKey),
          gte(insightsCache.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (cachedResult.length > 0) {
      submitLogEvent('receipt', 'Returning cached AI spending summary', correlationId, {
        userId: user.id,
        householdId,
        months,
        cacheAge: Date.now() - cachedResult[0].createdAt.getTime(),
      });
      return NextResponse.json(cachedResult[0].data);
    }

    // Calculate date range
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    submitLogEvent('receipt', 'Generating AI spending summary', correlationId, {
      userId: user.id,
      householdId,
      months,
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
        receiptCategory: receipts.category,
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
      .orderBy(desc(receipts.transactionDate))
      .limit(500); // Limit to prevent token overflow

    if (items.length === 0) {
      return NextResponse.json({
        summary: 'No receipt data found for the selected period.',
        itemCount: 0,
        period: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          months,
        },
      });
    }

    // Calculate basic statistics
    const totalSpent = items.reduce((sum, item) => {
      return sum + parseFloat(item.totalPrice || item.unitPrice || '0');
    }, 0);

    const categoryBreakdown: Record<string, number> = {};
    const merchantBreakdown: Record<string, number> = {};
    const itemFrequency: Record<string, number> = {};

    items.forEach((item) => {
      const price = parseFloat(item.totalPrice || item.unitPrice || '0');

      // Category breakdown
      const category = item.category || item.receiptCategory || 'other';
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + price;

      // Merchant breakdown
      const merchant = item.merchantName || 'Unknown';
      merchantBreakdown[merchant] = (merchantBreakdown[merchant] || 0) + price;

      // Item frequency
      itemFrequency[item.itemName] = (itemFrequency[item.itemName] || 0) + 1;
    });

    // Get top items by frequency
    const topItems = Object.entries(itemFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, count]) => ({ name, count }));

    // Get top categories
    const topCategories = Object.entries(categoryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([category, total]) => ({ category, total: parseFloat(total.toFixed(2)) }));

    // Get top merchants
    const topMerchants = Object.entries(merchantBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([merchant, total]) => ({ merchant, total: parseFloat(total.toFixed(2)) }));

    // Prepare data for AI analysis
    const dataForAI = {
      period: `${months} months`,
      totalItems: items.length,
      totalSpent: totalSpent.toFixed(2),
      currency: items[0]?.currency || user.currency || DEFAULT_CURRENCY,
      topItems: topItems.slice(0, 10),
      topCategories: topCategories.slice(0, 5),
      topMerchants: topMerchants.slice(0, 5),
    };

    // Generate AI summary using OpenAI lib
    const { summary: aiSummary, usage: aiUsage } = await generateSpendingSummary(
      dataForAI,
      email,
      user.id,
      correlationId,
    );

    const responseData = {
      summary: aiSummary,
      data: {
        period: {
          startDate: startDate.toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          months,
        },
        statistics: {
          totalItems: items.length,
          totalSpent: parseFloat(totalSpent.toFixed(2)),
          currency: items[0]?.currency || user.currency || DEFAULT_CURRENCY,
          averagePerItem: parseFloat((totalSpent / items.length).toFixed(2)),
        },
        topItems,
        topCategories,
        topMerchants,
      },
      usage: aiUsage,
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
          cacheType: 'spending_summary',
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
      submitLogEvent('receipt-error', `Failed to cache spending summary: ${cacheError instanceof Error ? cacheError.message : 'Unknown error'}`, correlationId, {}, true);
    }

    return NextResponse.json(responseData);
  } catch (error) {
    submitLogEvent('receipt-error', `Error generating spending summary: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to generate spending summary' },
      { status: 500 },
    );
  }
}
