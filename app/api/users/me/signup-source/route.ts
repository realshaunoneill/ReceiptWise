import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { type CorrelationId } from '@/lib/logging';
import { UserService } from '@/lib/services/user-service';
import { cleanAttribution } from '@/shared/attribution';

export const runtime = 'nodejs';

/**
 * POST /api/users/me/signup-source { source, campaign }: how a new account found ReceiptWise,
 * from /redirect after the first sign-in (shared/attribution.ts). No source is "direct". Kept only
 * the first time, and only for an account made in the last day, so an old account can't be
 * re-attributed.
 */
export async function POST(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  const auth = await getAuthenticatedUser(correlationId);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => null)) as { source?: unknown; campaign?: unknown } | null;
  const source = typeof body?.source === 'string' ? cleanAttribution(body.source) : null;
  const campaign = typeof body?.campaign === 'string' ? cleanAttribution(body.campaign) : null;
  const recorded = await UserService.recordSignupSource(auth.user, source ?? 'direct', campaign);
  return NextResponse.json({ recorded }, { headers: { 'Cache-Control': 'private, no-store' } });
}
