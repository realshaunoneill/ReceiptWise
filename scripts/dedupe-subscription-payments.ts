// Remove duplicate payment rows for the same subscription cycle, before the
// (subscription_id, expected_date) unique index goes in.
//
// Run with: npx tsx scripts/dedupe-subscription-payments.ts            (dry run: counts only)
//           npx tsx scripts/dedupe-subscription-payments.ts --apply    (deletes the extras)
// against DATABASE_URL (prefix with `npx dotenv -e .env.local --` for the dev database).
//
// Why: payment rows used to be generated on every list request with no lock, so two requests at
// once could insert the same cycle twice. The index has to wait until no duplicates remain:
// creating it over duplicates fails, and `drizzle-kit push` would carry on with the schema half
// applied (scripts/assert-schema.ts now catches that).
//
// Which row is kept: paid over cancelled over skipped over missed over pending; then one with a
// linked receipt; then the one most recently updated. Nothing is printed except counts.

import postgres from 'postgres';

const KEEP_ORDER = ['paid', 'cancelled', 'skipped', 'missed', 'pending'];

type Row = { id: string; subscription_id: string; expected_date: Date; status: string; receipt_id: string | null; updated_at: Date };

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('dedupe: DATABASE_URL is not set');
    process.exit(1);
  }
  const apply = process.argv.includes('--apply');

  const sql = postgres(url, { max: 1, connect_timeout: 10 });
  try {
    const rows = await sql<Row[]>`
      select p.id, p.subscription_id, p.expected_date, p.status, p.receipt_id, p.updated_at
      from subscription_payments p
      join (
        select subscription_id, expected_date
        from subscription_payments
        group by subscription_id, expected_date
        having count(*) > 1
      ) d on d.subscription_id = p.subscription_id and d.expected_date = p.expected_date
    `;

    const groups = new Map<string, Row[]>();
    for (const row of rows) {
      const key = `${row.subscription_id}|${row.expected_date.toISOString()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    const toDelete: string[] = [];
    for (const group of groups.values()) {
      const [, ...extras] = [...group].sort((a, b) =>
        (KEEP_ORDER.indexOf(a.status) - KEEP_ORDER.indexOf(b.status)) ||
        (Number(Boolean(b.receipt_id)) - Number(Boolean(a.receipt_id))) ||
        (b.updated_at.getTime() - a.updated_at.getTime()),
      );
      toDelete.push(...extras.map((row) => row.id));
    }

    console.log(`dedupe: ${groups.size} duplicated cycle(s), ${toDelete.length} extra row(s) across ${new Set(rows.map((r) => r.subscription_id)).size} subscription(s)`);

    if (toDelete.length === 0) return;
    if (!apply) {
      console.log('dedupe: dry run, nothing deleted. Re-run with --apply to delete the extras.');
      return;
    }

    const deleted = await sql`delete from subscription_payments where id in ${sql(toDelete)} returning id`;
    console.log(`dedupe: deleted ${deleted.length} row(s)`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error('dedupe: failed', error);
  process.exit(1);
});
