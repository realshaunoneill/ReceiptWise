import { type NextRequest, NextResponse } from 'next/server';
import { and, count, eq, gte, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { receipts, receiptItems } from '@/lib/db/schema';
import { getAuthenticatedUser, requireHouseholdMembership } from '@/lib/auth-helpers';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';

export const runtime = 'nodejs';

/** Cap on per-receipt points returned for charting. */
const MAX_POINTS = 5000;

/*
 * GET /api/receipts/stats?householdId=&personalOnly=&from=YYYY-MM-DD
 *
 * Totals for the dashboard and spending charts, computed in Postgres. They used to be computed in
 * the browser from `/api/receipts?limit=100` (the charts asked for 1000 and silently got 100), so
 * every figure was wrong past 100 receipts, and they counted receipts that were still pending,
 * had failed, or that the model had flagged as not a receipt at all — three stuck uploads showed
 * as three €0.00 receipts dragging the average down.
 *
 * Scope matches /api/receipts: a household (membership required), personal-only, or everything
 * the caller uploaded. Only completed, non-deleted rows that are actually receipts count.
 */

const numericTotal = sql<string>`CASE WHEN ${receipts.totalAmount} ~ '^-?[0-9]+([.][0-9]+)?$' THEN ${receipts.totalAmount}::numeric ELSE 0 END`;
const effectiveDate = sql<string>`COALESCE(${receipts.transactionDate}, TO_CHAR(${receipts.createdAt}, 'YYYY-MM-DD'))`;

export async function GET(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { searchParams } = new URL(req.url);
    const householdId = searchParams.get('householdId');
    const personalOnly = searchParams.get('personalOnly') === 'true';
    const fromRaw = searchParams.get('from');
    const from = fromRaw && /^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? fromRaw : null;

    if (householdId) {
      const membershipCheck = await requireHouseholdMembership(householdId, user.id, correlationId);
      if (membershipCheck) return membershipCheck;
    }

    const scope = householdId
      ? eq(receipts.householdId, householdId)
      : personalOnly
        ? and(eq(receipts.userId, user.id), isNull(receipts.householdId))
        : eq(receipts.userId, user.id);

    const counted = and(
      scope,
      isNull(receipts.deletedAt),
      eq(receipts.processingStatus, 'completed'),
      sql`COALESCE(${receipts.isReceipt}, true)`,
    );

    const [totals] = await db
      .select({
        totalReceipts: count(),
        totalSpent: sql<string>`COALESCE(SUM(${numericTotal}), 0)`,
      })
      .from(receipts)
      .where(counted);

    const [itemTotals] = await db
      .select({ totalItems: count() })
      .from(receiptItems)
      .innerJoin(receipts, eq(receiptItems.receiptId, receipts.id))
      .where(counted);

    const byCategory = await db
      .select({
        category: sql<string>`COALESCE(${receipts.category}, 'other')`,
        amount: sql<string>`COALESCE(SUM(${numericTotal}), 0)`,
      })
      .from(receipts)
      .where(counted)
      .groupBy(sql`COALESCE(${receipts.category}, 'other')`);

    const points = from
      ? await db
          .select({
            date: effectiveDate,
            amount: numericTotal,
            category: receipts.category,
          })
          .from(receipts)
          .where(and(counted, gte(effectiveDate, from)))
          .limit(MAX_POINTS)
      : undefined;

    const totalSpent = parseFloat(totals.totalSpent) || 0;
    const spendingByCategory = byCategory
      .map((row) => {
        const amount = parseFloat(row.amount) || 0;
        return {
          category: row.category,
          amount,
          percentage: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return NextResponse.json(
      {
        totalReceipts: totals.totalReceipts,
        totalItems: itemTotals.totalItems,
        totalSpent,
        avgSpending: totals.totalReceipts > 0 ? totalSpent / totals.totalReceipts : 0,
        spendingByCategory,
        ...(points && {
          points: points.map((p) => ({ date: p.date, amount: parseFloat(p.amount) || 0, category: p.category })),
        }),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    submitLogEvent('receipt', `Error computing receipt stats: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: 'Failed to load receipt stats' }, { status: 500 });
  }
}
