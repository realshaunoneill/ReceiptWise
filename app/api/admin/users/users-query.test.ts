import { describe, expect, it } from 'vitest';
import { QueryBuilder } from 'drizzle-orm/pg-core';
import { users } from '@/lib/db/schema';
import { userWithCountsFields } from './users-query';

describe('admin users query', () => {
  it('correlates the counts with the outer user, not the counted table', () => {
    const { sql } = new QueryBuilder().select(userWithCountsFields).from(users).toSQL();
    expect(sql).toContain('(select count(*) from "receipts" where "receipts"."user_id" = "users"."id")');
    expect(sql).toContain('(select count(*) from "household_users" where "household_users"."user_id" = "users"."id")');
  });
});
