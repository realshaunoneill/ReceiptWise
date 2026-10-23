import { randomUUID } from 'crypto';
import { waitUntil } from '@vercel/functions';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { markInboundEmailStored, processInboundEmail } from '@/lib/inbound-email/ingest';
import { isWorkerAuthorized } from '@/lib/inbound-email/worker-auth';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';

export const runtime = 'nodejs';
export const maxDuration = 300;

// POST /api/webhooks/inbound-email/stored - The Worker has uploaded the raw message: read it.
export async function POST(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  if (!isWorkerAuthorized(req)) {
    submitLogEvent('inbound-email', 'Unauthorized call to inbound-email/stored', correlationId, {}, true);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = z.object({ emailId: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  if (await markInboundEmailStored(parsed.data.emailId)) {
    // Answer the Worker straight away; the hourly sweep picks up anything this run doesn't finish.
    waitUntil(processInboundEmail(parsed.data.emailId, correlationId));
  }
  return NextResponse.json({ ok: true });
}
