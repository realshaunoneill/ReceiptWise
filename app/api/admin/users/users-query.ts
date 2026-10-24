import { eq, sql } from 'drizzle-orm';
import { householdUsers, receipts, users } from '@/lib/db/schema';

/**
 * The admin users list: each user with how many receipts and households they have.
 *
 * The counts are correlated subqueries, and their conditions are built with eq() on purpose.
 * Columns written straight into the select's sql`` template lose their table names in a
 * single-table select, so `receipts.user_id = users.id` came out as `"user_id" = "id"`, which
 * Postgres reads as receipts' own id: every user showed 0 receipts and 0 households. A nested
 * condition keeps the qualified names. COUNT(*) is a bigint, which the driver returns as a
 * string, hence mapWith(Number).
 */
export const userWithCountsFields = {
  id: users.id,
  email: users.email,
  subscribed: users.subscribed,
  isAdmin: users.isAdmin,
  isBlocked: users.isBlocked,
  blockedAt: users.blockedAt,
  blockedReason: users.blockedReason,
  createdAt: users.createdAt,
  stripeCustomerId: users.stripeCustomerId,
  receiptCount: sql<number>`(select count(*) from ${receipts} where ${eq(receipts.userId, users.id)})`.mapWith(Number),
  householdCount: sql<number>`(select count(*) from ${householdUsers} where ${eq(householdUsers.userId, users.id)})`.mapWith(Number),
};
