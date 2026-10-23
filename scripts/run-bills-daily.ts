// Run the bills daily job (/api/cron/bills-daily) by hand against DATABASE_URL.
// Run with: npm run bills:daily   (reads .env.local, so it targets the dev database)
//
// Vercel only runs crons in production, so dev and preview never create payment rows for cycles
// that came round, or mark direct debits paid, unless this is run.

import { SubscriptionService } from '../lib/services/subscription-service';

SubscriptionService.runDaily()
  .then((result) => {
    console.log('bills-daily:', result);
    process.exit(0);
  })
  .catch((error) => {
    console.error('bills-daily failed', error);
    process.exit(1);
  });
