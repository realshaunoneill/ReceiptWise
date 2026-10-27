import { type NotificationPrefs } from '../push/prefs';

/** GET/PATCH /api/users/me/notifications: the preferences, defaults filled in, and how many phones get them. */
export type WireNotificationSettings = {
  prefs: NotificationPrefs;
  devices: number;
};

/** POST /api/devices: a phone's Expo push token, registered or refreshed. */
export type WireDeviceRegistration = { ok: true };
