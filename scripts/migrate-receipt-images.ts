// Move receipt images from the public receipts store into the private store
// (lib/storage/receipt-image-url.ts has why and how they're shown).
//
//   npx tsx scripts/migrate-receipt-images.ts --environment production            # dry run
//   npx tsx scripts/migrate-receipt-images.ts --environment production --apply
//   npx tsx scripts/migrate-receipt-images.ts --delete-public prod/receipts/ --apply
//
// Against the database in DATABASE_URL, with BILLS_BLOB_READ_WRITE_TOKEN (the private store) and,
// for --delete-public, BLOB_READ_WRITE_TOKEN (the public one). --environment is the private-store
// folder the deployment using that database writes to: production, preview or development.
//
// Moving: each image is copied, read back and compared byte for byte, and only then is its row
// pointed at the copy (if the row still points at the old URL). The public original stays.
//
// --delete-public <prefix>: deletes public receipt images under the prefix that no row points at
// any more, in DATABASE_URL or in OTHER_DATABASE_URL if set (staging's copies of production rows
// point at production's public images, so clean up only after both databases are moved).

import { createHash, randomBytes } from 'crypto';
import { del, list } from '@vercel/blob';
import postgres from 'postgres';
import { putPrivate, readPrivate } from '../lib/storage/private-blob';
import { RECEIPT_IMAGE_TYPES } from '../lib/storage/receipt-blob';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const apply = process.argv.includes('--apply');
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

async function move(sql: postgres.Sql, environment: string) {
  const rows = await sql<{ id: string; user_id: string; image_url: string }[]>`
    select id, user_id, image_url from receipts
    where image_url like 'https://%.public.blob.vercel-storage.com/%'
    order by created_at`;
  console.log(`${rows.length} receipts with a public image${apply ? '' : ' (dry run: add --apply to move them)'}`);
  let moved = 0;
  for (const row of rows) {
    const response = await fetch(row.image_url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      console.log(`  ${row.id}: original answers ${response.status}, left as it is`);
      continue;
    }
    const contentType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    const extension = RECEIPT_IMAGE_TYPES[contentType];
    if (!extension) {
      console.log(`  ${row.id}: ${contentType} isn't an image type receipts use, left as it is`);
      continue;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!apply) {
      console.log(`  ${row.id}: would move ${bytes.length} bytes (${contentType})`);
      continue;
    }
    const pathname = `${environment}/receipts/${row.user_id}/migrated-${randomBytes(12).toString('hex')}.${extension}`;
    await putPrivate(pathname, bytes, contentType);
    const copy = await readPrivate(pathname);
    if (!copy || sha(copy) !== sha(bytes)) throw new Error(`${row.id}: the copy doesn't match the original; stopping`);
    const updated = await sql`
      update receipts set image_url = ${`private:${pathname}`}, updated_at = now()
      where id = ${row.id} and image_url = ${row.image_url}`;
    if (updated.count === 1) moved++;
    else console.log(`  ${row.id}: changed meanwhile, not repointed (copy left in the private store)`);
  }
  console.log(apply ? `moved ${moved}` : 'nothing changed');
}

async function deletePublic(sql: postgres.Sql, prefix: string) {
  if (!/^(prod|dev)\/receipts\/$/.test(prefix)) throw new Error('--delete-public takes prod/receipts/ or dev/receipts/');
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  const others = process.env.OTHER_DATABASE_URL ? postgres(process.env.OTHER_DATABASE_URL, { max: 1 }) : null;
  try {
    const referenced = new Set<string>();
    for (const db of [sql, others].filter((db): db is postgres.Sql => db !== null)) {
      const rows = await db<{ image_url: string }[]>`select image_url from receipts where image_url like 'https://%'`;
      for (const row of rows) referenced.add(new URL(row.image_url).pathname.slice(1));
    }
    const unused: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000, token });
      for (const blob of page.blobs) if (!referenced.has(blob.pathname)) unused.push(blob.url);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    console.log(`${unused.length} public images under ${prefix} that no receipt points at${others ? ' (both databases checked)' : ''}`);
    if (!apply) return console.log('dry run: add --apply to delete them');
    for (let i = 0; i < unused.length; i += 1000) await del(unused.slice(i, i + 1000), { token });
    console.log(`deleted ${unused.length}`);
  } finally {
    await others?.end();
  }
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    const prefix = option('--delete-public');
    if (prefix) return await deletePublic(sql, prefix);
    const environment = option('--environment');
    if (!environment || !['production', 'preview', 'development'].includes(environment)) {
      throw new Error('--environment production|preview|development is required');
    }
    await move(sql, environment);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
