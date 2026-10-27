import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { pushDevices } from '@/lib/db/schema';
import { type CorrelationId } from '@/lib/logging';

/** DELETE /api/devices/:token: signing out on a phone stops its notifications. Only your own token. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  const auth = await getAuthenticatedUser(correlationId);
  if (auth instanceof NextResponse) return auth;
  const { token } = await params;
  await db.delete(pushDevices).where(and(eq(pushDevices.expoToken, decodeURIComponent(token)), eq(pushDevices.userId, auth.user.id)));
  return new NextResponse(null, { status: 204 });
}
