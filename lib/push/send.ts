import { waitUntil } from '@vercel/functions';
import { and, eq, isNotNull, isNull, lte } from 'drizzle-orm';
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import { db } from '@/lib/db';
import { notificationLog, pushDevices, users } from '@/lib/db/schema';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { type NotificationPrefs, readPrefs } from '@/shared/push/prefs';
import { inQuietHours, KIND_CHANNEL, KIND_GROUP, type PushMessage, quietHoursEnd, validTimeZone } from './messages';

/**
 * Sending the app's push notifications, through Expo's push service (which talks to APNs and FCM
 * with the credentials kept on EAS). Each is logged in notification_log before it goes, keyed by
 * person, kind and thing, so it's sent once however many jobs or retries get there. One outside
 * quiet hours that the person didn't just cause themselves is held in the log, and cron/notify
 * sends it when they end.
 *
 * Nothing reaches a phone until the app's build with push exists and registers a token. Set
 * PUSH_DISABLED=1 to stop all sending. EXPO_ACCESS_TOKEN is only needed if the Expo project turns
 * on enhanced push security.
 */

export type NotifyResult = 'sent' | 'held' | 'off' | 'no-device' | 'duplicate' | 'disabled';

type NotifyOptions = {
  /** What it's about (a receipt's id, a bill's cycle): with the kind, it's sent once. */
  refKey: string;
  /** The person just did this (took the photo): quiet hours don't apply. */
  triggeredByUser?: boolean;
  now?: Date;
  correlationId?: CorrelationId;
};

const expo = () => new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN || undefined });

async function activeDevices(userId: string) {
  return db.select({ id: pushDevices.id, token: pushDevices.expoToken }).from(pushDevices).where(and(eq(pushDevices.userId, userId), isNull(pushDevices.disabledAt)));
}

/** Send one message to every phone of the person's; disable tokens the push service says are gone. */
async function deliver(userId: string, message: PushMessage, correlationId: CorrelationId | null): Promise<number> {
  const devices = (await activeDevices(userId)).filter((device) => Expo.isExpoPushToken(device.token));
  if (devices.length === 0) return 0;
  const messages: ExpoPushMessage[] = devices.map((device) => ({
    to: device.token,
    title: message.title,
    body: message.body,
    data: { url: message.url, kind: message.kind },
    sound: 'default',
    channelId: KIND_CHANNEL[message.kind],
  }));
  const client = expo();
  const tickets: ExpoPushTicket[] = [];
  for (const chunk of client.chunkPushNotifications(messages)) {
    tickets.push(...await client.sendPushNotificationsAsync(chunk));
  }
  let sent = 0;
  for (const [index, ticket] of tickets.entries()) {
    if (ticket.status === 'ok') {
      sent++;
    } else if (ticket.details?.error === 'DeviceNotRegistered') {
      await db.update(pushDevices).set({ disabledAt: new Date() }).where(eq(pushDevices.id, devices[index].id));
    } else {
      submitLogEvent('push', `Push not accepted: ${ticket.message}`, correlationId, { userId, kind: message.kind, error: ticket.details?.error }, false);
    }
  }
  return sent;
}

/**
 * Tell a person something, if they want to hear it: `build` gets their preferences (so it can
 * leave amounts out) and returns the message, or null to send nothing.
 */
export async function notify(userId: string, build: (prefs: NotificationPrefs) => PushMessage | null, options: NotifyOptions): Promise<NotifyResult> {
  if (process.env.PUSH_DISABLED === '1') return 'disabled';
  const now = options.now ?? new Date();
  const [user] = await db.select({ prefs: users.notificationPrefs, timeZone: users.timeZone }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return 'off';
  const prefs = readPrefs(user.prefs);
  const message = build(prefs);
  if (!message || !prefs[KIND_GROUP[message.kind]]) return 'off';
  if ((await activeDevices(userId)).length === 0) return 'no-device';

  const timeZone = validTimeZone(user.timeZone);
  const hold = !options.triggeredByUser && inQuietHours(now, timeZone);
  const [logged] = await db
    .insert(notificationLog)
    .values({ userId, kind: message.kind, refKey: options.refKey, sentAt: now, ...(hold ? { pendingUntil: quietHoursEnd(now, timeZone), payload: message } : {}) })
    .onConflictDoNothing({ target: [notificationLog.userId, notificationLog.kind, notificationLog.refKey] })
    .returning({ id: notificationLog.id });
  if (!logged) return 'duplicate';
  if (hold) return 'held';
  await deliver(userId, message, options.correlationId ?? null);
  return 'sent';
}

/** Send what was held for quiet hours and is now due (cron/notify, hourly). */
export async function sendHeld(now = new Date(), correlationId: CorrelationId | null = null): Promise<number> {
  if (process.env.PUSH_DISABLED === '1') return 0;
  const due = await db.select().from(notificationLog).where(and(isNotNull(notificationLog.pendingUntil), lte(notificationLog.pendingUntil, now))).limit(500);
  let sent = 0;
  for (const row of due) {
    // Claim it first, so two runs can't both send it.
    const [claimed] = await db
      .update(notificationLog)
      .set({ pendingUntil: null, sentAt: now })
      .where(and(eq(notificationLog.id, row.id), isNotNull(notificationLog.pendingUntil)))
      .returning({ id: notificationLog.id });
    if (!claimed) continue;
    const message = row.payload as PushMessage | null;
    if (!message?.kind || !KIND_GROUP[message.kind]) continue;
    // Turned off while it waited: it stays logged, unsent.
    const [user] = await db.select({ prefs: users.notificationPrefs }).from(users).where(eq(users.id, row.userId)).limit(1);
    if (!user || !readPrefs(user.prefs)[KIND_GROUP[message.kind]]) continue;
    sent += await deliver(row.userId, message, correlationId);
  }
  return sent;
}

/**
 * The same, after the response: a notification is never worth failing what caused it, so errors
 * are logged and dropped. Inside a request, Vercel keeps the function alive until it's done.
 */
export function notifyLater(userId: string, build: (prefs: NotificationPrefs) => PushMessage | null, options: NotifyOptions): void {
  const work = notify(userId, build, options).catch((error) => {
    submitLogEvent('push', `Push failed: ${error instanceof Error ? error.message : 'Unknown error'}`, options.correlationId ?? null, { userId, refKey: options.refKey }, true);
  });
  try {
    waitUntil(work);
  } catch {
    // Outside a request (a script): the promise still runs.
  }
}
