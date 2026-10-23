import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isLocalDate, toUtcDate } from '@/lib/dates/local-date';
import { fromCents, toCents } from '@/lib/money';
import { BILLING_FREQUENCIES, utcDay } from '@/lib/schedule/billing-schedule';
import { SUPPORTED_CURRENCIES } from '@/lib/utils/currency';

/**
 * Request-body validation for the finance routes (subscriptions/bills now; accounts, income
 * and goals later). Errors come back in the flat `{ error }` shape the client already reads.
 */

const CURRENCY_CODES = SUPPORTED_CURRENCIES.map((currency) => currency.code) as [string, ...string[]];

export const SUBSCRIPTION_STATUSES = ['active', 'paused', 'cancelled'] as const;
export const SUBSCRIPTION_KINDS = ['subscription', 'bill'] as const;
export const AMOUNT_TYPES = ['fixed', 'variable'] as const;
export const PAYMENT_METHODS = ['direct_debit', 'standing_order', 'card', 'manual'] as const;
export const PAYMENT_STATUSES = ['pending', 'paid', 'missed', 'skipped', 'cancelled'] as const;

/** A non-negative decimal amount, normalised to the two-decimal string the amount columns hold. */
const amount = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const cents = toCents(value);
    if (cents === null || cents < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be a number, 0 or more' });
      return z.NEVER;
    }
    return fromCents(cents);
  });

/**
 * A calendar day, as YYYY-MM-DD or a full ISO timestamp, stored as midnight UTC of that day (the
 * convention of the older timestamp columns). The dialogs send `new Date('YYYY-MM-DD')`, which
 * serialises to midnight UTC, so the UTC day is the day the user picked.
 */
const day = z.string().transform((value, ctx) => {
  if (isLocalDate(value)) return toUtcDate(value);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be a date' });
    return z.NEVER;
  }
  return utcDay(parsed);
});

/** A calendar day for the Postgres `date` columns, which hold YYYY-MM-DD strings. */
const localDate = z.string().refine(isLocalDate, 'must be a YYYY-MM-DD date');

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional()
  .transform((value) => (value === '' ? null : value));

const subscriptionFields = {
  name: z.string().trim().min(1, 'is required').max(200),
  description: optionalText(1000),
  category: optionalText(50),
  amount,
  currency: z.enum(CURRENCY_CODES),
  billingFrequency: z.enum(BILLING_FREQUENCIES),
  billingDay: z.coerce.number().int().min(1).max(31),
  customFrequencyDays: z.coerce.number().int().min(1).max(3660).nullable().optional(),
  startDate: day,
  endDate: day.nullable().optional(),
  status: z.enum(SUBSCRIPTION_STATUSES),
  householdId: z.string().uuid().nullable().optional(),
  isBusinessExpense: z.boolean(),
  website: optionalText(500),
  notes: optionalText(2000),
  kind: z.enum(SUBSCRIPTION_KINDS),
  amountType: z.enum(AMOUNT_TYPES),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable().optional(),
  accountReference: z.string().trim().regex(/^[A-Za-z0-9]{1,4}$/, 'must be the last 4 characters only').nullable().optional()
    .or(z.literal('').transform(() => null)),
};

export const createSubscriptionSchema = z
  .object({
    ...subscriptionFields,
    // A one-off has no day of the month: it falls on its start date.
    billingDay: subscriptionFields.billingDay.optional(),
    currency: subscriptionFields.currency.default('EUR'),
    status: subscriptionFields.status.optional(),
    isBusinessExpense: subscriptionFields.isBusinessExpense.default(false),
    kind: subscriptionFields.kind.default('subscription'),
    amountType: subscriptionFields.amountType.default('fixed'),
  })
  .superRefine((value, ctx) => {
    if (value.billingFrequency === 'custom' && !value.customFrequencyDays) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customFrequencyDays'], message: 'is required for a custom frequency' });
    }
    if (value.billingFrequency !== 'once' && !value.billingDay) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['billingDay'], message: 'is required' });
    }
  });

export const updateSubscriptionSchema = z.object(subscriptionFields).partial().strict();

export const updatePaymentSchema = z
  .object({
    receiptId: z.string().uuid().optional(),
    status: z.enum(PAYMENT_STATUSES).optional(),
    actualDate: day.nullable().optional(),
    actualAmount: amount.nullable().optional(),
    expectedAmount: amount.optional(),
    dueDate: localDate.nullable().optional(),
    notes: optionalText(2000),
  })
  .strict();

/** PUT /api/subscriptions/[id]/occurrences: the cycle to act on, plus the same changes as a payment PATCH. */
export const upsertOccurrenceSchema = updatePaymentSchema
  .omit({ receiptId: true })
  .extend({ expectedDate: localDate })
  .strict();

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type UpsertOccurrenceInput = z.infer<typeof upsertOccurrenceSchema>;

/** Parse a request body, or the 400 to send: `{ error: "<field> <problem>" }`. */
export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
): { data: z.infer<T> } | NextResponse {
  const result = schema.safeParse(body);
  if (result.success) return { data: result.data };

  const issue = result.error.issues[0];
  const field = issue.path.join('.');
  const message = issue.code === 'unrecognized_keys'
    ? `Unknown field: ${issue.keys.join(', ')}`
    : field ? `${field} ${issue.message}` : issue.message;
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Read a JSON body without throwing on an empty or malformed one. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}
