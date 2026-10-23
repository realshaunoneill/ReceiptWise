import { randomUUID } from 'crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { startInboundEmail } from '@/lib/inbound-email/ingest';
import { TOKEN_PATTERN } from '@/lib/inbound-email/token';
import { isWorkerAuthorized } from '@/lib/inbound-email/worker-auth';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { isPrivateStoreConfigured } from '@/lib/storage/private-blob';

export const runtime = 'nodejs';

const startSchema = z.object({
  token: z.string().regex(TOKEN_PATTERN),
  messageKey: z.string().min(1).max(1000),
  sizeBytes: z.number().int().nonnegative(),
  from: z.string().max(1000).nullable().optional(),
  subject: z.string().max(2000).nullable().optional(),
});

// POST /api/webhooks/inbound-email/start - Called by the Cloudflare Email Worker for each message to
// <token>@in.receiptwise.io: store it, drop it (a repeat), or reject it (unknown address, no Premium…).
// Public in proxy.ts with the other webhooks; authenticated by INBOUND_WORKER_SECRET.
export async function POST(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  if (!isWorkerAuthorized(req)) {
    submitLogEvent('inbound-email', 'Unauthorized call to inbound-email/start', correlationId, {}, true);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isPrivateStoreConfigured()) return NextResponse.json({ action: 'reject', reason: 'Not set up' });

  const parsed = startSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ action: 'reject', reason: 'Unknown address' });

  try {
    const result = await startInboundEmail({ ...parsed.data, from: parsed.data.from ?? null, subject: parsed.data.subject ?? null }, correlationId);
    return NextResponse.json(result);
  } catch (error) {
    submitLogEvent('inbound-email', `inbound-email/start failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    // A 500 makes the Worker forward the message to the fallback mailbox, so nothing is lost.
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
