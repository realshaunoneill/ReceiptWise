// Print the weekly growth report (lib/growth) without posting it.
//
//   npx tsx scripts/growth-report.ts [YYYY-MM-DD]   (the Monday that ends the week; default: the latest)
//
// Reads the database in DATABASE_URL and the Stripe account in STRIPE_SECRET_KEY.

import { gatherGrowthData } from '../lib/growth/gather';
import { formatGrowthReport, reportWeekEnd } from '../lib/growth/report';

async function main() {
  const date = process.argv[2];
  const to = date ? reportWeekEnd(new Date(`${date}T12:00:00Z`)) : reportWeekEnd(new Date());
  console.log(formatGrowthReport(await gatherGrowthData(to)));
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
