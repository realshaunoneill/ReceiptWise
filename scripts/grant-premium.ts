// Give Premium by hand (testers, App Review's demo account, family), or end it.
//
//   npx tsx scripts/grant-premium.ts <email> [--days 30 | --until 2027-01-31] [--note "Play tester"]
//   npx tsx scripts/grant-premium.ts <email> --revoke
//
// Against the database in DATABASE_URL (use `npx dotenv -e .env.local --` for the preview one).
// This is a `comp` grant (premium_grants): a Stripe or app store subscription still counts
// either way, and ending comp Premium never ends paid Premium.

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { users } from '../lib/db/schema';
import { grantComp, revokeComp } from '../lib/services/entitlement-service';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function until(): Date | null {
  const days = option('--days');
  const date = option('--until');
  if (days) {
    const n = Number(days);
    if (!Number.isInteger(n) || n <= 0) throw new Error('--days takes a whole number of days');
    return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
  }
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('--until takes a date, YYYY-MM-DD');
    return new Date(`${date}T23:59:59Z`);
  }
  return null;
}

async function main() {
  const email = process.argv[2];
  if (!email || email.startsWith('--')) {
    console.error('Usage: npx tsx scripts/grant-premium.ts <email> [--days N | --until YYYY-MM-DD] [--note "..."] [--revoke]');
    process.exit(1);
  }
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
  if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
  }

  const correlationId = randomUUID();
  if (process.argv.includes('--revoke')) {
    const premium = await revokeComp(user.id, correlationId);
    console.log(`Comp Premium ended for ${email}. Premium now ${premium.subscribed ? `on (${premium.source})` : 'off'}.`);
  } else {
    const end = until();
    const premium = await grantComp(user.id, { until: end, note: option('--note') ?? 'Given by script' }, correlationId);
    console.log(`Comp Premium for ${email} ${end ? `until ${end.toISOString().slice(0, 10)}` : 'with no end date'}. Premium now ${premium.subscribed ? `on (${premium.source})` : 'off'}.`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
