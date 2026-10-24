import { generateText, Output } from 'ai';
import { z } from 'zod';
import { gatewayOptions, modelFor, toTokenUsage, type TokenUsage } from '@/lib/ai-model';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { normalizeReceiptDate } from '@/lib/receipt-ai';

/**
 * Read a bill: who it's from, what's due and when, and for a credit card statement the balance and
 * minimum payment, with the model lib/ai-model.ts picks for bills. PDFs go as a file part (the
 * model gets the text and an image of each page, so scanned PDFs work too); photos as an image
 * part; a forwarded email with no attachment as its text.
 *
 * Logging: only ids, the document type and token counts. A bill holds names, addresses and
 * account numbers, so its contents never go to the log sink.
 */

export const BILL_DOCUMENT_TYPES = [
  'utility_bill',
  'credit_card_statement',
  'invoice',
  'receipt',
  'bill_notification',
  'bank_statement',
  'other',
] as const;
export type BillDocumentType = typeof BILL_DOCUMENT_TYPES[number];

const billDataSchema = z.object({
  documentType: z.enum(BILL_DOCUMENT_TYPES).describe(
    'utility_bill: electricity, gas, broadband, phone, water, bin, TV licence. credit_card_statement: a card statement. '
    + 'invoice: any other bill to pay. receipt: proof of something already paid. bill_notification: an email saying a bill '
    + 'is ready to view online that does NOT say how much is due (if it states the amount due, it is a utility_bill or invoice). '
    + 'bank_statement: a current/savings account statement. other: none of these.',
  ),
  provider: z.string().nullable().describe('Who the bill is from, as they name themselves, e.g. "Electric Ireland".'),
  amountDue: z.number().nullable().describe('The total to pay for this bill. For a card statement, the statement balance.'),
  currency: z.string().nullable().describe('ISO code, e.g. "EUR".'),
  dueDate: z.string().nullable().describe('When payment is due or will be collected, YYYY-MM-DD.'),
  issueDate: z.string().nullable().describe('The bill or statement date, YYYY-MM-DD.'),
  periodStart: z.string().nullable().describe('Start of the billing period, YYYY-MM-DD.'),
  periodEnd: z.string().nullable().describe('End of the billing period, YYYY-MM-DD.'),
  statementBalance: z.number().nullable().describe('Card statements only: the closing balance.'),
  minimumPayment: z.number().nullable().describe('Card statements only: the minimum payment due.'),
  accountNumberLast4: z.string().nullable().describe('The LAST 4 characters of the account or card number only. Never more.'),
  isDirectDebit: z.boolean().nullable().describe('True if the bill says it will be paid by direct debit.'),
  inCredit: z.boolean().nullable().describe('True if nothing is owed (the account is in credit).'),
  confidence: z.enum(['high', 'medium', 'low']).describe('How sure you are of the amount and due date.'),
});

export type BillData = z.infer<typeof billDataSchema>;

export type BillInput =
  | { kind: 'file'; bytes: Buffer; mimeType: string; fileName?: string | null }
  | { kind: 'text'; text: string; subject?: string | null };

/** Upper bound on the whole call, retries included; inside the routes' maxDuration. */
const EXTRACTION_TIMEOUT_MS = 60_000;

function prompt(today: string): string {
  return `Today's date is ${today}. This is a document someone uploaded or forwarded to plan their monthly bills. Read it and fill in the fields.

- Decide the documentType first. If it isn't a bill, statement or invoice, say so and leave the money fields null.
- amountDue is what has to be paid for this bill, as a number without a currency sign. A bill in credit owes nothing: amountDue 0 and inCredit true.
- dueDate is when the money goes: "Payment due", "Due date", "Direct debit will be taken on", "Amount will be debited on". Not the bill date.
- issueDate is the date of the bill or statement itself.
- For a credit card statement, amountDue and statementBalance are the closing balance, and minimumPayment the minimum due.
- Dates as YYYY-MM-DD. Irish and UK documents write dates day first (03/11/2026 is 3 November 2026).
- accountNumberLast4: only the last 4 characters of an account, MPRN, card or reference number. NEVER output a full account number, card number or IBAN anywhere.
- Use null for anything not on the document. Don't guess amounts.`;
}

export async function analyzeBillDocument(
  input: BillInput,
  context: { userId: string; documentId: string; correlationId: CorrelationId; model?: string },
): Promise<{ data: BillData; usage: TokenUsage }> {
  const today = new Date().toISOString().split('T')[0];
  const content = input.kind === 'text'
    ? [{ type: 'text' as const, text: `${prompt(today)}\n\nEmail subject: ${input.subject ?? '(none)'}\n\nEmail text:\n${input.text}` }]
    : input.mimeType === 'application/pdf'
      ? [
        { type: 'text' as const, text: prompt(today) },
        { type: 'file' as const, data: input.bytes, mediaType: 'application/pdf', filename: input.fileName ?? 'bill.pdf' },
      ]
      : [
        { type: 'text' as const, text: prompt(today) },
        { type: 'image' as const, image: input.bytes, mediaType: input.mimeType },
      ];

  const model = modelFor('bill', context.model);
  const generated = await generateText({
    model,
    output: Output.object({ schema: billDataSchema, name: 'bill' }),
    providerOptions: gatewayOptions('bill', context.model),
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(EXTRACTION_TIMEOUT_MS),
    messages: [{ role: 'user', content }],
  });
  const result = { object: generated.output, usage: toTokenUsage(generated.usage, generated.providerMetadata) };

  submitLogEvent('bill-document', 'Bill read', context.correlationId, {
    documentId: context.documentId,
    userId: context.userId,
    documentType: result.object.documentType,
    confidence: result.object.confidence,
    model,
    servedBy: generated.response.modelId,
    promptTokens: result.usage.promptTokens,
    completionTokens: result.usage.completionTokens,
  });

  const last4 = result.object.accountNumberLast4?.replace(/\s/g, '').slice(-4) || null;
  // "Your bill is ready" emails that do give the amount and due date are bills, whatever the model called them.
  const documentType = result.object.documentType === 'bill_notification' && result.object.amountDue !== null && result.object.dueDate
    ? 'utility_bill'
    : result.object.documentType;
  return {
    data: {
      ...result.object,
      documentType,
      dueDate: normalizeReceiptDate(result.object.dueDate),
      issueDate: normalizeReceiptDate(result.object.issueDate),
      periodStart: normalizeReceiptDate(result.object.periodStart),
      periodEnd: normalizeReceiptDate(result.object.periodEnd),
      accountNumberLast4: last4,
      currency: result.object.currency?.trim().toUpperCase().match(/^[A-Z]{3}$/)?.[0] ?? null,
    },
    usage: result.usage,
  };
}

/** A PDF with an /Encrypt dictionary is password-protected; the model can't read it. */
export function isEncryptedPdf(bytes: Buffer): boolean {
  return bytes.subarray(0, 4).toString('latin1') === '%PDF' && bytes.includes(Buffer.from('/Encrypt'));
}
