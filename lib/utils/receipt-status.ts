/*
 * Client-side view of whether a receipt can be retried.
 *
 * Retry used to be offered only for 'failed'. A receipt whose processing never finished — the tab
 * closed mid-upload, or the function was killed — stayed 'pending' or 'processing' with no way
 * out. The server (lib/receipt-processing.ts) will re-claim a 'processing' row after 5 minutes,
 * and the hourly sweep marks it failed, so the UI offers Retry on the same 5-minute schedule.
 */

const STALE_AFTER_MS = 5 * 60 * 1000;

type ReceiptStatusFields = {
  processingStatus: string | null;
  updatedAt: string | Date;
};

export function isStuckProcessing(receipt: ReceiptStatusFields, now: number = Date.now()): boolean {
  if (receipt.processingStatus !== 'pending' && receipt.processingStatus !== 'processing') {
    return false;
  }
  const updated = new Date(receipt.updatedAt).getTime();
  return Number.isFinite(updated) && now - updated > STALE_AFTER_MS;
}

export function canRetryReceipt(receipt: ReceiptStatusFields, now: number = Date.now()): boolean {
  return receipt.processingStatus === 'failed' || isStuckProcessing(receipt, now);
}
