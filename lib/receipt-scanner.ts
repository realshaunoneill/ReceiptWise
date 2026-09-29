// No 'use server' here. That directive turns every exported async function into a Server
// Action callable from the browser by id, and these are unauthenticated data-layer helpers
// (getHouseholdReceipts(householdId), deleteReceipt(id), ...). Route handlers authorize, then
// call in.

import { db } from '@/lib/db';
import { receipts, receiptItems, users, householdUsers } from '@/lib/db/schema';
import { eq, desc, asc, count, isNull, and, or, gte, lte, ilike, sql, inArray, exists } from 'drizzle-orm';
import type { ReceiptWithItems } from '@/lib/types/api-responses';

export interface GetReceiptsOptions {
  userId: string;
  householdId?: string | null;
  personalOnly?: boolean;
  page?: number;
  limit?: number;
  includeDeleted?: boolean;
  // Search and filter options
  search?: string;
  category?: string;
  merchant?: string;
  minAmount?: string;
  maxAmount?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: string;
  isBusinessExpense?: string;
  searchAllHouseholds?: boolean; // When true, search across all user's receipts regardless of householdId
}

export interface PaginatedReceipts {
  receipts: ReceiptWithItems[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * totalAmount is text, written from model output. A bare CAST(... AS DECIMAL) makes one
 * non-numeric value 500 the whole list for that user, so non-numeric values read as NULL.
 */
const numericTotal = sql<number>`CASE WHEN ${receipts.totalAmount} ~ '^-?[0-9]+([.][0-9]+)?$' THEN ${receipts.totalAmount}::numeric END`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Escape LIKE/ILIKE wildcards so a search for "50%" or "a_b" matches literally. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Get receipts with pagination and filtering
 */
export async function getReceipts(options: GetReceiptsOptions): Promise<PaginatedReceipts> {
  const {
    userId,
    householdId,
    personalOnly = false,
    page = 1,
    limit = 10,
    includeDeleted = false,
    search,
    category,
    merchant,
    minAmount,
    maxAmount,
    startDate,
    endDate,
    sortBy = 'date',
    sortOrder = 'desc',
    isBusinessExpense,
    searchAllHouseholds = false,
  } = options;

  const offset = (page - 1) * limit;

  // Build base conditions
  const baseConditions = [
    includeDeleted ? undefined : isNull(receipts.deletedAt),
  ].filter(Boolean);

  // Build search/filter conditions
  const filterConditions = [];

  // Text search across merchant name, category, and line items.
  // The item match is a correlated EXISTS on this receipt's own items. It used to prefetch the
  // first 1000 matching item rows across *every* user's receipts and intersect, so for a common
  // term a user's own matches could fall outside that window and silently not be found.
  if (search) {
    const pattern = `%${escapeLikePattern(search)}%`;
    filterConditions.push(
      or(
        ilike(receipts.merchantName, pattern),
        ilike(receipts.category, pattern),
        exists(
          db
            .select({ one: sql`1` })
            .from(receiptItems)
            .where(and(eq(receiptItems.receiptId, receipts.id), ilike(receiptItems.name, pattern))),
        ),
      ),
    );
  }

  // Category filter
  if (category) {
    filterConditions.push(ilike(receipts.category, category));
  }

  // Merchant filter
  if (merchant) {
    filterConditions.push(ilike(receipts.merchantName, `%${merchant}%`));
  }

  // Amount range filter
  const min = minAmount ? parseFloat(minAmount) : NaN;
  const max = maxAmount ? parseFloat(maxAmount) : NaN;
  if (Number.isFinite(min)) {
    filterConditions.push(gte(numericTotal, min));
  }
  if (Number.isFinite(max)) {
    filterConditions.push(lte(numericTotal, max));
  }

  // Date range filter
  if (startDate) {
    filterConditions.push(gte(receipts.transactionDate, startDate));
  }
  if (endDate) {
    filterConditions.push(lte(receipts.transactionDate, endDate));
  }

  // Business expense filter
  if (isBusinessExpense === 'true') {
    filterConditions.push(eq(receipts.isBusinessExpense, true));
  } else if (isBusinessExpense === 'false') {
    filterConditions.push(or(eq(receipts.isBusinessExpense, false), isNull(receipts.isBusinessExpense)));
  }

  // Determine sort field and order
  let sortField;
  switch (sortBy) {
    case 'amount':
      sortField = numericTotal;
      break;
    case 'merchant':
      sortField = receipts.merchantName;
      break;
    case 'created':
      // Upload order, for "recent receipts": the latest uploads, whatever date is on them.
      sortField = receipts.createdAt;
      break;
    case 'date':
    default:
      // Must be a SQL COALESCE, not a JS `||`: `receipts.transactionDate` is a Drizzle column
      // object and therefore always truthy, so the createdAt fallback never applied and rows
      // with no extracted transaction date sorted unpredictably. transactionDate is text
      // ('YYYY-MM-DD'), so createdAt is formatted the same way to stay comparable.
      sortField = sql`COALESCE(${receipts.transactionDate}, TO_CHAR(${receipts.createdAt}, 'YYYY-MM-DD'))`;
      break;
  }
  const orderFn = sortOrder === 'asc' ? asc : desc;
  // Tiebreakers make the order total. Without them, receipts sharing a date could swap places
  // between LIMIT/OFFSET pages, showing up twice or not at all.
  const orderBy = [orderFn(sortField), desc(receipts.createdAt), desc(receipts.id)];

  let userReceipts;
  let totalCount;

  // When searchAllHouseholds is true and there's a search query, ignore household filter
  const shouldSearchAllHouseholds = searchAllHouseholds && search;

  if (householdId && !shouldSearchAllHouseholds) {
    // Get receipts for specific household.
    // The EXISTS clause is defence in depth: callers are expected to have already run
    // requireHouseholdMembership, but without this the filter would be householdId alone
    // and any authenticated user could read any household's receipts by guessing an id.
    const conditions = and(
      eq(receipts.householdId, householdId),
      exists(
        db
          .select({ one: sql`1` })
          .from(householdUsers)
          .where(
            and(
              eq(householdUsers.householdId, householdId),
              eq(householdUsers.userId, userId),
            ),
          ),
      ),
      ...baseConditions,
      ...filterConditions,
    );

    userReceipts = await db
      .select()
      .from(receipts)
      .where(conditions)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(receipts)
      .where(conditions);
    totalCount = countResult.count;
  } else if (personalOnly && !shouldSearchAllHouseholds) {
    // Get only personal receipts (not assigned to any household)
    const conditions = and(
      eq(receipts.userId, userId),
      isNull(receipts.householdId),
      ...baseConditions,
      ...filterConditions,
    );

    userReceipts = await db
      .select()
      .from(receipts)
      .where(conditions)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(receipts)
      .where(conditions);
    totalCount = countResult.count;
  } else {
    // Get all receipts for the user (personal + household)
    const conditions = and(
      eq(receipts.userId, userId),
      ...baseConditions,
      ...filterConditions,
    );

    userReceipts = await db
      .select()
      .from(receipts)
      .where(conditions)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(receipts)
      .where(conditions);
    totalCount = countResult.count;
  }

  // Get items and user info for all receipts in batch (avoid N+1 queries)
  const receiptIds = userReceipts.map(r => r.id);
  const userIds = [...new Set(userReceipts.map(r => r.userId))];

  // Batch fetch all items for all receipts
  const allItems = receiptIds.length > 0
    ? await db
        .select()
        .from(receiptItems)
        .where(inArray(receiptItems.receiptId, receiptIds))
    : [];

  // Batch fetch all users
  const allUsers = userIds.length > 0
    ? await db
        .select({
          id: users.id,
          email: users.email,
        })
        .from(users)
        .where(inArray(users.id, userIds))
    : [];

  // Create lookup maps for O(1) access
  const itemsByReceiptId = new Map<string, typeof allItems>();
  allItems.forEach(item => {
    const existing = itemsByReceiptId.get(item.receiptId) || [];
    existing.push(item);
    itemsByReceiptId.set(item.receiptId, existing);
  });

  const userEmailById = new Map<string, string>();
  allUsers.forEach(user => {
    userEmailById.set(user.id, user.email);
  });

  // Build receipts with details using lookup maps (no additional queries)
  const receiptsWithDetails = userReceipts.map((receipt) => ({
    ...receipt,
    items: itemsByReceiptId.get(receipt.id) || [],
    submittedBy: userEmailById.get(receipt.userId) || 'Unknown',
  }));

  return {
    receipts: receiptsWithDetails,
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
      hasNext: page < Math.ceil(totalCount / limit),
      hasPrev: page > 1,
    },
  };
}

/**
 * Get receipts for a user (legacy - use getReceipts instead)
 * @deprecated Use getReceipts with options instead
 */
export async function getUserReceipts(userId: string) {
  return await db
    .select()
    .from(receipts)
    .where(and(eq(receipts.userId, userId), isNull(receipts.deletedAt)))
    .orderBy(desc(receipts.createdAt));
}

/**
 * Get receipts for a household (legacy - use getReceipts instead)
 * @deprecated Use getReceipts with options instead
 */
export async function getHouseholdReceipts(householdId: string) {
  return await db
    .select()
    .from(receipts)
    .where(and(eq(receipts.householdId, householdId), isNull(receipts.deletedAt)))
    .orderBy(desc(receipts.createdAt));
}

/**
 * Get a single receipt by ID with items and user info
 * Optimized to use batch queries instead of sequential queries
 */
export async function getReceiptById(receiptId: string, includeDeleted = false): Promise<ReceiptWithItems | null> {
  // A non-UUID id is a Postgres cast error (a 500), not a missing receipt (a 404).
  if (!UUID_PATTERN.test(receiptId)) {
    return null;
  }

  const conditions = includeDeleted
    ? eq(receipts.id, receiptId)
    : and(eq(receipts.id, receiptId), isNull(receipts.deletedAt));

  // Fetch receipt with user email in a single query using join
  const [receiptWithUser] = await db
    .select({
      receipt: receipts,
      userEmail: users.email,
    })
    .from(receipts)
    .leftJoin(users, eq(receipts.userId, users.id))
    .where(conditions)
    .limit(1);

  if (!receiptWithUser) {
    return null;
  }

  // Fetch items (this is a separate query but unavoidable for 1-to-many)
  const items = await db
    .select()
    .from(receiptItems)
    .where(eq(receiptItems.receiptId, receiptId));

  return {
    ...receiptWithUser.receipt,
    items,
    submittedBy: receiptWithUser.userEmail || 'Unknown',
  };
}

/**
 * Soft delete a receipt.
 *
 * Does no authorization of its own — the caller must already have run requireReceiptOwner.
 * (It used to re-check `receipt.userId === userId` with the caller's id, which made an admin
 * deletion that had passed the route's admin check fail with a 500.) The row and its image are
 * purged for good by the sweep-receipts cron 30 days later.
 */
export async function deleteReceipt(receiptId: string): Promise<boolean> {
  const receipt = await getReceiptById(receiptId);
  if (!receipt) {
    return false;
  }

  // Soft delete
  await db
    .update(receipts)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(receipts.id, receiptId));

  return true;
}
