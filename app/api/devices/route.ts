import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { Expo } from 'expo-server-sdk';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { db } from '@/lib/db';
import { pushDevices, users } from '@/lib/db/schema';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { validTimeZone } from '@/lib/push/messages';

const body = z.object({
  token: z.string().max(200).refine((token) => Expo.isExpoPushToken(token), 'Not an Expo push token'),
  platform: z.enum(['ios', 'android']),
  appVersion: z.string().max(40).optional(),
  locale: z.string().max(40).optional(),
  timeZone: z.string().max(64).optional(),
}).strict();

/**
 * POST /api/devices: the app registers its push token on every launch once notifications are
 * allowed, with the phone's time zone (notifications go out at the person's own 9 am, and keep
 * their quiet hours). It registers once for each account signed in on the phone (a household's
 * shared iPad), so each of them gets their own notifications; a disabled token (the push service
 * said it was gone) comes back if the phone sends it again. The answer carries the account's id,
 * which notifications carry too, so the app can tell whose a tapped one is.
 */
export async function POST(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  const auth = await getAuthenticatedUser(correlationId);
  if (auth instanceof NextResponse) return auth;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid device' }, { status: 400 });
  const { token, platform, appVersion, locale } = parsed.data;
  const timeZone = parsed.data.timeZone ? validTimeZone(parsed.data.timeZone) : null;

  await db
    .insert(pushDevices)
    .values({ userId: auth.user.id, expoToken: token, platform, appVersion, locale, timeZone })
    .onConflictDoUpdate({
      target: [pushDevices.expoToken, pushDevices.userId],
      set: { userId: auth.user.id, platform, appVersion, locale, timeZone, lastSeenAt: new Date(), disabledAt: null },
    });
  if (timeZone && timeZone !== auth.user.timeZone) {
    await db.update(users).set({ timeZone, updatedAt: new Date() }).where(eq(users.id, auth.user.id));
  }
  submitLogEvent('push', 'Device registered', correlationId, { userId: auth.user.id, platform, appVersion });
  return NextResponse.json({ ok: true, userId: auth.user.id }, { headers: { 'Cache-Control': 'private, no-store' } });
}
