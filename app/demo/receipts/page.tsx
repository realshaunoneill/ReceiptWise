import ReceiptsPage from '@/app/(protected)/receipts/page';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Demo receipts - ReceiptWise',
  description: 'A made-up household\'s receipts in ReceiptWise, each read for you.',
  path: '/demo/receipts',
  index: false,
});

export default function DemoReceiptsPage() {
  return <ReceiptsPage />;
}
