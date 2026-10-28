/**
 * Push notification preferences, as the app's and the website's Settings show them: one switch
 * per group of notifications, plus "hide amounts". Framework-free (shared/): the server fills the
 * defaults in with readPrefs, both clients render the same list.
 */

export const NOTIFICATION_GROUPS = [
  { key: 'receipts', label: 'Receipts read', detail: "When a receipt from the app, the extension or email has been read, or couldn't be", default: true },
  { key: 'billInbox', label: 'Bills to file', detail: "A bill read and ready to file, filed for you, or that couldn't be read", default: true },
  { key: 'billsDue', label: 'Bills to pay', detail: 'A bill you pay by hand due tomorrow, and once if it goes overdue', default: true },
  { key: 'payday', label: 'Payday', detail: "The new month's plan, on the morning you're paid", default: true },
  { key: 'household', label: 'Households', detail: 'An invitation to a household, and someone joining yours', default: true },
  { key: 'billing', label: 'Premium', detail: "A trial about to end, or a payment that didn't go through", default: true },
  { key: 'partnerDigest', label: 'Household activity', detail: 'A daily round-up of what others in your household added', default: false },
  { key: 'weeklySummary', label: 'Weekly summary', detail: 'What went out last week, on Monday morning', default: false },
] as const;

export type NotificationGroup = typeof NOTIFICATION_GROUPS[number]['key'];

export type NotificationPrefs = Record<NotificationGroup, boolean> & {
  /** Leave amounts out of what shows on the lock screen. */
  hideAmounts: boolean;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  ...(Object.fromEntries(NOTIFICATION_GROUPS.map((group) => [group.key, group.default])) as Record<NotificationGroup, boolean>),
  hideAmounts: false,
};

const KEYS = [...NOTIFICATION_GROUPS.map((group) => group.key), 'hideAmounts'] as const;

/** What's stored (users.notification_prefs), with the defaults for anything missing or malformed. */
export function readPrefs(stored: unknown): NotificationPrefs {
  const prefs = { ...DEFAULT_PREFS };
  if (stored && typeof stored === 'object') {
    for (const key of KEYS) {
      const value = (stored as Record<string, unknown>)[key];
      if (typeof value === 'boolean') prefs[key] = value;
    }
  }
  return prefs;
}

/** A change from either client: only known keys, only booleans. */
export function applyPrefs(current: NotificationPrefs, change: unknown): NotificationPrefs {
  return readPrefs({ ...current, ...(change && typeof change === 'object' ? change : {}) });
}
