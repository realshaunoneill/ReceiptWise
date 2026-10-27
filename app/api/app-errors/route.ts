import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';

/**
 * POST /api/app-errors: a crash in the app, from its error screen, logged with the website's own
 * errors (Rapid7, alerting) so a failure on a phone can be read without the phone. Signed in
 * only, and only the error itself: its message, stack, the screen's path and the app's version,
 * never what was on screen. submitLogEvent masks any email address in it.
 */
const report = z.object({
  message: z.string().max(1000),
  stack: z.string().max(6000).optional(),
  componentStack: z.string().max(4000).optional(),
  path: z.string().max(300).optional(),
  appVersion: z.string().max(40).optional(),
  updateId: z.string().max(80).optional(),
  platform: z.enum(['ios', 'android', 'web']).optional(),
}).strict();

export async function POST(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  const auth = await getAuthenticatedUser(correlationId);
  if (auth instanceof NextResponse) return auth;
  if (Number(req.headers.get('content-length') || 0) > 16 * 1024) return NextResponse.json({ error: 'Too large' }, { status: 413 });

  const parsed = report.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid report' }, { status: 400 });
  const { message, ...detail } = parsed.data;
  submitLogEvent('app-error', `App crash: ${message}`, correlationId, { userId: auth.user.id, client: req.headers.get('x-client'), ...detail }, true);
  return new NextResponse(null, { status: 204 });
}
