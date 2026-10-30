import PlanPage from '@/app/(protected)/plan/page';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'A demo month - ReceiptWise',
  description: 'See ReceiptWise with a made-up household: their pay, their bills and what is left for each week until payday. No account needed.',
  path: '/demo/plan',
});

export default function DemoPlanPage() {
  return <PlanPage />;
}
