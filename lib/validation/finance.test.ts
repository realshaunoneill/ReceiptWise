import { describe, expect, it } from 'vitest';
import {
  createIncomeSchema,
  createSubscriptionSchema,
  updatePaymentSchema,
  updateSubscriptionSchema,
  upsertOccurrenceSchema,
} from './finance';

const base = { name: 'Electric Ireland', amount: '142.3', billingFrequency: 'monthly', billingDay: 14, startDate: '2026-10-14' };

describe('createSubscriptionSchema', () => {
  it('normalises amounts and dates and fills the defaults', () => {
    const result = createSubscriptionSchema.parse(base);
    expect(result.amount).toBe('142.30');
    expect(result.startDate.toISOString()).toBe('2026-10-14T00:00:00.000Z');
    expect(result).toMatchObject({ currency: 'EUR', kind: 'subscription', amountType: 'fixed', isBusinessExpense: false });
  });

  it('reads an ISO timestamp as its UTC day', () => {
    expect(createSubscriptionSchema.parse({ ...base, startDate: '2026-10-14T00:00:00.000Z' }).startDate.toISOString())
      .toBe('2026-10-14T00:00:00.000Z');
  });

  it('rejects bad amounts, frequencies and currencies', () => {
    expect(createSubscriptionSchema.safeParse({ ...base, amount: '-1' }).success).toBe(false);
    expect(createSubscriptionSchema.safeParse({ ...base, amount: '1e3' }).success).toBe(false);
    expect(createSubscriptionSchema.safeParse({ ...base, billingFrequency: 'fortnightly' }).success).toBe(false);
    expect(createSubscriptionSchema.safeParse({ ...base, currency: 'XYZ' }).success).toBe(false);
  });

  it('needs custom days for a custom frequency, and no billing day for a one-off', () => {
    expect(createSubscriptionSchema.safeParse({ ...base, billingFrequency: 'custom' }).success).toBe(false);
    expect(createSubscriptionSchema.safeParse({ ...base, billingFrequency: 'custom', customFrequencyDays: 14 }).success).toBe(true);
    const { billingDay: _unused, ...withoutDay } = base;
    expect(createSubscriptionSchema.safeParse({ ...withoutDay, billingFrequency: 'once' }).success).toBe(true);
    expect(createSubscriptionSchema.safeParse({ ...withoutDay, billingFrequency: 'monthly' }).success).toBe(false);
  });

  it('takes the account it is paid from, or null for the main one', () => {
    const accountId = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    expect(createSubscriptionSchema.parse({ ...base, paidFromAccountId: accountId }).paidFromAccountId).toBe(accountId);
    expect(updateSubscriptionSchema.parse({ paidFromAccountId: null })).toEqual({ paidFromAccountId: null });
    expect(updateSubscriptionSchema.safeParse({ paidFromAccountId: 'current' }).success).toBe(false);
  });

  it('keeps only the last 4 of an account reference', () => {
    expect(createSubscriptionSchema.parse({ ...base, accountReference: '1234' }).accountReference).toBe('1234');
    expect(createSubscriptionSchema.parse({ ...base, accountReference: '' }).accountReference).toBeNull();
    expect(createSubscriptionSchema.safeParse({ ...base, accountReference: 'IE29AIBK93115212345678' }).success).toBe(false);
  });
});

describe('updateSubscriptionSchema', () => {
  it('accepts a partial update and rejects unknown fields', () => {
    expect(updateSubscriptionSchema.parse({ name: 'Netflix' })).toEqual({ name: 'Netflix' });
    expect(updateSubscriptionSchema.safeParse({ userId: 'someone-else' }).success).toBe(false);
  });

  it('turns empty optional text into null and validates status', () => {
    expect(updateSubscriptionSchema.parse({ notes: '' })).toEqual({ notes: null });
    expect(updateSubscriptionSchema.safeParse({ status: 'deleted' }).success).toBe(false);
  });
});

describe('payment schemas', () => {
  it('accepts the statuses and normalises amounts', () => {
    expect(updatePaymentSchema.parse({ status: 'skipped' })).toEqual({ status: 'skipped' });
    expect(updatePaymentSchema.parse({ expectedAmount: 61 })).toEqual({ expectedAmount: '61.00' });
    expect(updatePaymentSchema.safeParse({ status: 'refunded' }).success).toBe(false);
  });

  it('requires a real cycle date for occurrences', () => {
    expect(upsertOccurrenceSchema.safeParse({ expectedDate: '2026-11-14', status: 'paid' }).success).toBe(true);
    expect(upsertOccurrenceSchema.safeParse({ expectedDate: '2026-02-30' }).success).toBe(false);
    expect(upsertOccurrenceSchema.safeParse({ expectedDate: '2026-11-14', receiptId: crypto.randomUUID() }).success).toBe(false);
  });
});

describe('createIncomeSchema', () => {
  it("leaves primary unset unless asked, so the route doesn't demote an existing salary", () => {
    const salary = { name: 'Salary', amount: '3820', frequency: 'monthly', payDay: 25 };
    expect(createIncomeSchema.parse(salary).isPrimary).toBeUndefined();
    expect(createIncomeSchema.parse({ ...salary, isPrimary: true }).isPrimary).toBe(true);
    expect(createIncomeSchema.parse(salary)).toMatchObject({ weekendRule: 'previous_business_day', status: 'active', currency: 'EUR' });
  });
});
