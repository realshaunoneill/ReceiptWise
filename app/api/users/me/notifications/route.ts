import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { and, count, eq, isNull } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { pushDevices, users } from '@/lib/db/schema';
import { type CorrelationId } from '@/lib/logging';
import { applyPrefs, type NotificationPrefs, readPrefs } from '@/shared/push/prefs';
import { type WireNotificationSettings } from '@/shared/api/notifications';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

async function settings(userId: string, prefs: NotificationPrefs): Promise<WireNotificationSettings> {
  const [{ devices }] = await db.select({ devices: count() }).from(pushDevices).where(and(eq(pushDevices.userId, userId), isNull(pushDevices.disabledAt)));
  return { prefs, devices };
}

/**
 * GET /api/users/me/notifications: which push notifications are on (defaults filled in), and how
 * many phones get them. The app's and the website's Settings show the same switches.
 */
export async function GET() {
  const correlationId = randomUUID() as CorrelationId;
  const auth = await getAuthenticatedUser(correlationId);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(await settings(auth.user.id, readPrefs(auth.user.notificationPrefs)), { headers: NO_STORE });
}

/** PATCH /api/users/me/notifications { receipts?: boolean, …, hideAmounts?: boolean }: unknown keys are ignored. */
export async function PATCH(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  const auth = await getAuthenticatedUser(correlationId);
  if (auth instanceof NextResponse) return auth;
  const change = await req.json().catch(() => null);
  if (!change || typeof change !== 'object' || Array.isArray(change)) return NextResponse.json({ error: 'Send the switches to change' }, { status: 400 });
  const prefs = applyPrefs(readPrefs(auth.user.notificationPrefs), change);
  await db.update(users).set({ notificationPrefs: prefs, updatedAt: new Date() }).where(eq(users.id, auth.user.id));
  return NextResponse.json(await settings(auth.user.id, prefs), { headers: NO_STORE });
}
