// Print the SQL that `drizzle-kit push` would run against DATABASE_URL, without running it.
// Run with: npm run db:diff   (it reads .env.local, so it targets the dev database)
//   or, for another database: DATABASE_URL=… npx tsx scripts/schema-diff.ts
//
// The build applies the schema with `drizzle-kit push --force`, which accepts data-loss
// statements without asking (a rename becomes a drop and re-create) and has no dry-run flag.
// Read this output before merging a schema change.

import { type SQL } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { pushSchema } from 'drizzle-kit/api';
import postgres from 'postgres';
import * as schema from '../lib/db/schema';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('schema-diff: DATABASE_URL is not set');
    process.exit(1);
  }

  const client = postgres(url, { max: 1, connect_timeout: 10 });
  try {
    const db = drizzle(client, { casing: 'snake_case' });
    // pushSchema reads `(await execute(sql)).rows`, the node-postgres result shape; postgres-js
    // returns the rows array itself.
    const nodePgShaped = { execute: async (query: SQL) => ({ rows: await db.execute(query) }) };
    const { statementsToExecute, warnings, hasDataLoss } = await pushSchema(
      schema as Record<string, unknown>,
      nodePgShaped as unknown as Parameters<typeof pushSchema>[1],
    );

    if (statementsToExecute.length === 0) {
      console.log('schema-diff: no changes');
      return;
    }

    console.log(`schema-diff: ${statementsToExecute.length} statement(s) would run${hasDataLoss ? ' — INCLUDING DATA LOSS' : ''}:\n`);
    for (const statement of statementsToExecute) console.log(`${statement.trim().replace(/;+$/, '')};\n`);
    for (const warning of warnings) console.log(`warning: ${warning}`);
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error('schema-diff: failed', error);
  process.exit(1);
});
