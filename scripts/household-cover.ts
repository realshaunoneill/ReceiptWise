// Who a household's Premium covers (lib/entitlements.ts decideHouseholdCover), and whether the
// household grants match it. Read-only unless --apply, which brings them in line, as the hourly
// reconcile-store-premium cron does.
//
//   npx tsx scripts/household-cover.ts [--apply]
//
// Against the database in DATABASE_URL (use `npx dotenv -e .env.local --` for the preview one).

import { randomUUID } from 'crypto';
import { inArray } from 'drizzle-orm';
import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import type { CorrelationId } from '../lib/logging';
import { householdCoverPlan, reconcileHouseholdCover } from '../lib/services/entitlement-service';

async function main() {
  const { cover, existing } = await householdCoverPlan();
  const ids = [...new Set([...cover.keys(), ...cover.values(), ...existing.map((grant) => grant.userId)])];
  const emails = new Map(
    ids.length ? (await db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, ids))).map((u) => [u.id, u.email]) : [],
  );
  const who = (id: string | null) => (id ? emails.get(id) ?? id : '—');

  console.log(`Covered now: ${cover.size}`);
  for (const [member, payer] of cover) console.log(`  ${who(member)}  ←  ${who(payer)}`);
  const stale = existing.filter((grant) => grant.status === 'active' && !cover.has(grant.userId));
  const missing = [...cover].filter(([member, payer]) => !existing.some((g) => g.userId === member && g.status === 'active' && g.productId === payer));
  console.log(`Grants to add or re-point: ${missing.length}; to end: ${stale.length}`);

  if (process.argv.includes('--apply')) {
    const result = await reconcileHouseholdCover(randomUUID() as CorrelationId);
    console.log(`Applied: ${result.changed} changed, ${result.covered} covered.`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
