import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, applyPrefs, readPrefs } from '@/shared/push/prefs';
import { billDue, billFiled, billRead, inQuietHours, isMorningRound, localClock, payday, quietHoursEnd, receiptRead, validTimeZone } from './messages';

const hidden = { ...DEFAULT_PREFS, hideAmounts: true };

describe('push messages', () => {
  it('says what was read, with the amount unless amounts are hidden', () => {
    const receipt = { id: 'r1', merchantName: 'Tesco', totalAmount: '42.10', currency: 'EUR', itemCount: 5 };
    expect(receiptRead(receipt, DEFAULT_PREFS)).toMatchObject({ title: 'Receipt read', body: 'Tesco · €42.10 · 5 items', url: '/receipts?selected=r1' });
    expect(receiptRead(receipt, hidden).body).toBe('Tesco · 5 items');
  });

  it('gives a bill its provider, amount and due date', () => {
    const document = { provider: 'Electric Ireland', fileName: null, amountDue: '84.20', currency: 'EUR', dueDate: '2026-11-12' };
    expect(billRead(document, DEFAULT_PREFS).body).toBe('Electric Ireland · €84.20 due 12 Nov');
    expect(billFiled(document, hidden).body).toBe("Electric Ireland · due 12 Nov. It's in the plan.");
  });

  it('opens the bill a reminder is about', () => {
    expect(billDue({ id: 'b1', name: 'Rent', amount: '300.00', currency: 'EUR' }, DEFAULT_PREFS)).toMatchObject({ body: "Rent · €300.00. You pay it by hand, so tick it off once it's paid.", url: '/subscriptions?selected=b1' });
  });

  it('puts the month and what is left in the payday note', () => {
    expect(payday({ month: 'November', remainingCents: 17973, weeklyCents: 4493, currency: 'EUR' }, DEFAULT_PREFS).body).toBe("November's plan starts today. €179.73 left after everything planned, €44.93 a week.");
    expect(payday({ month: 'November', remainingCents: -5000, weeklyCents: 0, currency: 'EUR' }, DEFAULT_PREFS).body).toContain('€50.00 over');
    expect(payday({ month: 'November', remainingCents: 17973, weeklyCents: 4493, currency: 'EUR' }, hidden).body).toBe("November's plan starts today.");
  });
});

describe('when they may be sent', () => {
  // 2026-11-02 is in Irish winter time (UTC+0); 2026-07-01 in summer time (UTC+1).
  it('keeps quiet from 21:30 to 08:00 local', () => {
    expect(inQuietHours(new Date('2026-11-02T21:29:00Z'), 'Europe/Dublin')).toBe(false);
    expect(inQuietHours(new Date('2026-11-02T21:30:00Z'), 'Europe/Dublin')).toBe(true);
    expect(inQuietHours(new Date('2026-11-02T07:59:00Z'), 'Europe/Dublin')).toBe(true);
    expect(inQuietHours(new Date('2026-11-02T08:00:00Z'), 'Europe/Dublin')).toBe(false);
    // 07:30 UTC in July is 08:30 in Dublin, but 03:30 in New York.
    expect(inQuietHours(new Date('2026-07-01T07:30:00Z'), 'Europe/Dublin')).toBe(false);
    expect(inQuietHours(new Date('2026-07-01T07:30:00Z'), 'America/New_York')).toBe(true);
  });

  it('holds a quiet-hours message until 08:00 local', () => {
    expect(quietHoursEnd(new Date('2026-11-02T23:10:00Z'), 'Europe/Dublin').toISOString()).toBe('2026-11-03T08:00:00.000Z');
    expect(quietHoursEnd(new Date('2026-07-01T05:00:00Z'), 'Europe/Dublin').toISOString()).toBe('2026-07-01T07:00:00.000Z');
    const now = new Date('2026-11-02T12:00:00Z');
    expect(quietHoursEnd(now, 'Europe/Dublin').getTime()).toBe(now.getTime());
  });

  it("runs the morning round at 9 o'clock local, and reads the local day", () => {
    expect(isMorningRound(new Date('2026-07-01T08:15:00Z'), 'Europe/Dublin')).toBe(true);
    expect(isMorningRound(new Date('2026-11-02T08:15:00Z'), 'Europe/Dublin')).toBe(false);
    expect(localClock(new Date('2026-11-02T23:30:00Z'), 'Australia/Sydney').date).toBe('2026-11-03');
  });

  it('falls back to Ireland for a time zone it does not know', () => {
    expect(validTimeZone('Not/AZone')).toBe('Europe/Dublin');
    expect(validTimeZone(null)).toBe('Europe/Dublin');
    expect(validTimeZone('Europe/Paris')).toBe('Europe/Paris');
  });
});

describe('preferences', () => {
  it('fills in the defaults and ignores what it does not know', () => {
    expect(readPrefs(null)).toEqual(DEFAULT_PREFS);
    expect(readPrefs({ receipts: false, nonsense: true, payday: 'yes' })).toEqual({ ...DEFAULT_PREFS, receipts: false });
    expect(DEFAULT_PREFS.partnerDigest).toBe(false);
    expect(applyPrefs(DEFAULT_PREFS, { hideAmounts: true, billing: 1 })).toEqual({ ...DEFAULT_PREFS, hideAmounts: true });
  });
});
