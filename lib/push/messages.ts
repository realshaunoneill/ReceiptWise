import { formatCents } from '@/shared/currency';
import { formatLocalDate, type LocalDate } from '@/shared/dates/local-date';
import { toCents } from '@/shared/money';
import { type NotificationGroup, type NotificationPrefs } from '@/shared/push/prefs';

/**
 * What the app's push notifications say, which preference each belongs to, and when they may be
 * sent. Pure (tested in messages.test.ts); lib/push/send.ts sends them.
 *
 * Copy follows DESIGN.md: plain, sentence case, Irish English, no exclamation marks or emoji.
 * With "hide amounts" on, nothing a stranger could read off a lock screen says how much.
 * `url` is a website path the app's src/links.ts maps to its own screen.
 */

export const KIND_GROUP = {
  receipt_read: 'receipts',
  receipt_failed: 'receipts',
  bill_read: 'billInbox',
  bill_filed: 'billInbox',
  bill_failed: 'billInbox',
  bill_due: 'billsDue',
  bill_overdue: 'billsDue',
  payday: 'payday',
  invite_received: 'household',
  member_joined: 'household',
  trial_ending: 'billing',
  payment_failed: 'billing',
} as const satisfies Record<string, NotificationGroup>;

export type NotificationKind = keyof typeof KIND_GROUP;

/** Android's channels (the app creates them); each kind posts to one. */
export const KIND_CHANNEL: Record<NotificationKind, 'receipts' | 'bills' | 'household' | 'account'> = {
  receipt_read: 'receipts',
  receipt_failed: 'receipts',
  bill_read: 'bills',
  bill_filed: 'bills',
  bill_failed: 'bills',
  bill_due: 'bills',
  bill_overdue: 'bills',
  payday: 'bills',
  invite_received: 'household',
  member_joined: 'household',
  trial_ending: 'account',
  payment_failed: 'account',
};

export type PushMessage = { kind: NotificationKind; title: string; body: string; url: string };

const day = (value: LocalDate) => formatLocalDate(value, { day: 'numeric', month: 'short' }, 'en-IE');
const money = (amount: string | number | null | undefined, currency: string | null | undefined) => {
  const cents = toCents(amount ?? null);
  return cents === null ? null : formatCents(cents, currency ?? 'EUR');
};
const join = (...parts: Array<string | null | undefined | false>) => parts.filter(Boolean).join(' · ');

export function receiptRead(receipt: { id: string; merchantName: string | null; totalAmount: string | null; currency: string | null; itemCount: number }, prefs: NotificationPrefs): PushMessage {
  const items = receipt.itemCount === 1 ? '1 item' : receipt.itemCount > 1 ? `${receipt.itemCount} items` : null;
  return {
    kind: 'receipt_read',
    title: 'Receipt read',
    body: join(receipt.merchantName || 'Your receipt', !prefs.hideAmounts && money(receipt.totalAmount, receipt.currency), items),
    url: `/receipts?selected=${receipt.id}`,
  };
}

export function receiptFailed(receipt: { id: string }): PushMessage {
  return { kind: 'receipt_failed', title: "Couldn't read a receipt", body: 'Try a clearer photo, or read it again from Receipts.', url: `/receipts?selected=${receipt.id}` };
}

type BillDocumentLike = { provider: string | null; fileName: string | null; amountDue: string | null; currency: string | null; dueDate: LocalDate | null };

function billLine(document: BillDocumentLike, prefs: NotificationPrefs): string {
  const name = document.provider || document.fileName || 'Your bill';
  const amount = prefs.hideAmounts ? null : money(document.amountDue, document.currency);
  const due = document.dueDate ? `due ${day(document.dueDate)}` : null;
  return amount ? join(name, [amount, due].filter(Boolean).join(' ')) : join(name, due);
}

export function billRead(document: BillDocumentLike, prefs: NotificationPrefs): PushMessage {
  return { kind: 'bill_read', title: 'A bill is ready to file', body: billLine(document, prefs), url: '/plan' };
}

/** An email that only says the bill is ready online: the bill itself has to be brought in. */
export function billNeedsDocument(document: BillDocumentLike): PushMessage {
  const name = document.provider || document.fileName || 'A bill';
  return { kind: 'bill_read', title: 'A bill needs its document', body: `${name}: the email only says the bill is ready online. Download it and bring it in.`, url: '/plan' };
}

export function billFiled(document: BillDocumentLike, prefs: NotificationPrefs): PushMessage {
  return { kind: 'bill_filed', title: 'Bill filed', body: `${billLine(document, prefs)}. It's in the plan.`, url: '/plan' };
}

export function billFailed(document: { fileName: string | null }): PushMessage {
  return { kind: 'bill_failed', title: "Couldn't read a bill", body: `${document.fileName ? `${document.fileName}: open` : 'Open'} the bill inbox to try again.`, url: '/plan' };
}

export function billDue(bill: { id: string; name: string; amount: string | null; currency: string }, prefs: NotificationPrefs): PushMessage {
  const amount = prefs.hideAmounts ? null : money(bill.amount, bill.currency);
  return { kind: 'bill_due', title: 'Due tomorrow', body: `${join(bill.name, amount)}. You pay it by hand, so tick it off once it's paid.`, url: `/subscriptions?selected=${bill.id}` };
}

export function billOverdue(bill: { id: string; name: string; dueDate: LocalDate }): PushMessage {
  return { kind: 'bill_overdue', title: 'Overdue', body: `${bill.name} was due ${day(bill.dueDate)} and isn't ticked off.`, url: `/subscriptions?selected=${bill.id}` };
}

export function payday(plan: { month: string; remainingCents: number; weeklyCents: number; currency: string }, prefs: NotificationPrefs): PushMessage {
  const over = plan.remainingCents < 0;
  const figures = prefs.hideAmounts
    ? ''
    : over
      ? ` More is planned than comes in: ${formatCents(-plan.remainingCents, plan.currency)} over.`
      : ` ${formatCents(plan.remainingCents, plan.currency)} left after everything planned, ${formatCents(plan.weeklyCents, plan.currency)} a week.`;
  return { kind: 'payday', title: 'Payday', body: `${plan.month}'s plan starts today.${figures}`, url: '/plan' };
}

export function inviteReceived(invite: { householdName: string; invitedBy: string | null }): PushMessage {
  return {
    kind: 'invite_received',
    title: `You're invited to ${invite.householdName}`,
    body: `${invite.invitedBy ? `From ${invite.invitedBy}. ` : ''}Open it to join, or say no thanks.`,
    url: '/sharing',
  };
}

export function memberJoined(member: { householdName: string; who: string }): PushMessage {
  return { kind: 'member_joined', title: `${member.householdName} has a new member`, body: `${member.who} joined. They can see what's shared with the household.`, url: '/sharing' };
}

export function trialEnding(trial: { endsOn: LocalDate | null }): PushMessage {
  return { kind: 'trial_ending', title: 'Your free trial ends soon', body: trial.endsOn ? `It ends ${day(trial.endsOn)}, and Premium carries on unless it's cancelled.` : "Premium carries on unless it's cancelled.", url: '/settings' };
}

export function paymentFailed(): PushMessage {
  return { kind: 'payment_failed', title: "A Premium payment didn't go through", body: 'Check the card on file so Premium keeps going.', url: '/settings' };
}

// ----- When -----

export const DEFAULT_TIME_ZONE = 'Europe/Dublin';

/** A time zone the runtime knows, else Ireland's (most people using it are there). */
export function validTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-IE', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** The calendar day and time in a time zone. */
export function localClock(now: Date, timeZone: string): { date: LocalDate; hour: number; minute: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: validTimeZone(timeZone), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
}

/** Quiet hours, 21:30 to 08:00 local: only what the person just did themselves comes through. */
export function inQuietHours(now: Date, timeZone: string): boolean {
  const { hour, minute } = localClock(now, timeZone);
  const minutes = hour * 60 + minute;
  return minutes >= 21 * 60 + 30 || minutes < 8 * 60;
}

/** When quiet hours end: the next 08:00 local, as an instant. */
export function quietHoursEnd(now: Date, timeZone: string): Date {
  // Step forward a minute at a time from now would be exact but slow; quarter hours are enough,
  // then land on the first minute that isn't quiet.
  let at = new Date(now.getTime());
  for (let i = 0; i < 4 * 12 && inQuietHours(at, timeZone); i++) at = new Date(at.getTime() + 15 * 60_000);
  while (!inQuietHours(new Date(at.getTime() - 60_000), timeZone) && at > now) at = new Date(at.getTime() - 60_000);
  return at;
}

/** The hourly job's morning round goes out at 9 o'clock local. */
export function isMorningRound(now: Date, timeZone: string): boolean {
  return localClock(now, timeZone).hour === 9;
}
