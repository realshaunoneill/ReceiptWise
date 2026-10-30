import SubscriptionsPage from '@/app/(protected)/subscriptions/page';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Demo bills - ReceiptWise',
  description: 'A made-up household\'s bills and subscriptions in ReceiptWise.',
  path: '/demo/subscriptions',
  index: false,
});

export default function DemoBillsPage() {
  return <SubscriptionsPage />;
}
