/** GET /api/inbound-address: the forwarding address for bills and receipts (made on first use). */
export type WireInboundAddress = {
  address: string;
  createdAt: string;
  rotatedAt: string | null;
};

/** One of GET /api/inbound-emails: a forwarded email and what happened to it (the last 20). */
export type WireInboundEmail = {
  id: string;
  fromAddress: string | null;
  subject: string | null;
  /** 'receiving' | 'stored' | 'processed' | 'no_content' | 'rejected_limit' | 'forwarding_confirmation' | 'failed' */
  status: string;
  error: string | null;
  partCount: number | null;
  confirmationCode: string | null;
  confirmationUrl: string | null;
  receivedAt: string;
};
