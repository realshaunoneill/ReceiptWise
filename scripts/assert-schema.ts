// Fails the build when the database is missing a table, column or named index from lib/db/schema.ts.
// Run with: npm run db:assert   (locally: npx dotenv -e .env.local -- npm run db:assert)
//
// Why: the build runs `drizzle-kit push --force` first, and drizzle-kit 0.31 applies its statements
// one at a time with no transaction, catches any error, prints it and exits 0. A failed statement
// (say a unique index hitting duplicate rows) therefore left the schema half-applied while
// `next build` carried on and deployed code that expects the missing columns. This turns that into
// a failed deploy.
//
// Only presence is checked. Types, defaults and foreign keys are drizzle-kit's job; what this catches
// is the push having stopped part-way.

import { is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as schema from '../lib/db/schema';

type Expected = { table: string; columns: string[]; indexes: string[] };

function expectedTables(): Expected[] {
  return Object.values(schema as Record<string, unknown>)
    .filter((value): value is PgTable => is(value, PgTable))
    .map((table) => {
      const config = getTableConfig(table);
      return {
        table: config.name,
        columns: config.columns.map((column) => column.name),
        // Unnamed indexes and unique() constraints get generated names, so only named ones are checked.
        indexes: config.indexes.map((index) => index.config.name).filter((name): name is string => Boolean(name)),
      };
    });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('assert-schema: DATABASE_URL is not set');
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, connect_timeout: 10 });
  try {
    const columnRows = await sql<{ table_name: string; column_name: string }[]>`
      select table_name, column_name from information_schema.columns where table_schema = 'public'
    `;
    const indexRows = await sql<{ tablename: string; indexname: string }[]>`
      select tablename, indexname from pg_indexes where schemaname = 'public'
    `;

    const columns = new Map<string, Set<string>>();
    for (const row of columnRows) {
      if (!columns.has(row.table_name)) columns.set(row.table_name, new Set());
      columns.get(row.table_name)!.add(row.column_name);
    }
    const indexes = new Set(indexRows.map((row) => `${row.tablename}.${row.indexname}`));

    const problems: string[] = [];
    for (const expected of expectedTables()) {
      const actual = columns.get(expected.table);
      if (!actual) {
        problems.push(`missing table ${expected.table}`);
        continue;
      }
      for (const column of expected.columns) {
        if (!actual.has(column)) problems.push(`missing column ${expected.table}.${column}`);
      }
      for (const index of expected.indexes) {
        if (!indexes.has(`${expected.table}.${index}`)) problems.push(`missing index ${expected.table}.${index}`);
      }
    }

    if (problems.length > 0) {
      console.error('assert-schema: the database does not match lib/db/schema.ts. The schema push above probably failed part-way:');
      for (const problem of problems) console.error(`  - ${problem}`);
      process.exit(1);
    }

    console.log(`assert-schema: ${expectedTables().length} tables match lib/db/schema.ts`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error('assert-schema: failed to check the schema', error);
  process.exit(1);
});
