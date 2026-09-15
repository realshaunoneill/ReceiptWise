import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * The processing state of a receipt, as a badge.
 *
 * This switch existed twice verbatim — in `receipt-list.tsx` and in
 * `detail-modal/receipt-header.tsx` — plus a third partial version inline in
 * `receipt-timeline.tsx`. All three carried the same two problems:
 *
 *   1. The label was a sentence. "Processing - Wait a minute, if it doesn't
 *      complete contact support" was the badge text. `Badge` is `overflow-hidden`,
 *      so it was clipped part-way through regardless.
 *   2. "Failed - Please contact support" told the user to email support about a
 *      failure that has a Retry button beside it.
 *
 * A badge states the state. Anything a user can act on belongs next to the
 * control that acts on it.
 */
export function ReceiptStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return (
        <Badge variant="outline" className="border-success/25 bg-success/10 text-success">
          <CheckCircle className="h-3 w-3" aria-hidden="true" />
          Scanned
        </Badge>
      );
    case 'processing':
    case 'pending':
      return (
        <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
          <Clock className="h-3 w-3" aria-hidden="true" />
          Processing
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="border-destructive/25 bg-destructive/10 text-destructive">
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          Failed
        </Badge>
      );
    default:
      return null;
  }
}
