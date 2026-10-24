import { generateText, Output } from 'ai';
import { gatewayOptions, modelFor, toTokenUsage, type TokenUsage } from '@/lib/ai-model';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { z } from 'zod';

// Zod schemas for type-safe AI responses.
//
// Every optional field is `.nullable()` and never `.optional()` or `.default()`: OpenAI's strict
// structured output (which the gateway uses for openai/* models) requires every key to be listed
// as required, and a request whose schema leaves one out is rejected with a 400 at call time.
const itemModifierSchema = z.object({
  name: z.string(),
  price: z.number(),
  type: z.enum(['fee', 'deposit', 'discount', 'addon', 'modifier']),
});

const receiptItemSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable(),
  // Nullable: the model occasionally returns null for one unreadable line, and a strict number
  // here failed schema validation for the whole receipt. Treated as 0 downstream.
  price: z.number().nullable(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  modifiers: z.array(itemModifierSchema).nullable(),
});

const receiptDataSchema = z.object({
  isReceipt: z.boolean().describe('Whether this image appears to be a receipt, invoice, or purchase-related document. False if it\'s a screenshot, meme, random image, etc.'),
  // A bill asks for a payment not made yet; the app offers to move those to Bills.
  documentKind: z.enum(['receipt', 'bill', 'other']).nullable(),
  merchant: z.string().nullable(),
  total: z.number().nullable(),
  currency: z.string().nullable(),
  date: z.string().nullable(),
  category: z.string().nullable(),
  items: z.array(receiptItemSchema).nullable(),
  rawItems: z.array(z.object({
    name: z.string(),
    price: z.number().nullable(),
  })).nullable(),
  location: z.string().nullable(),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  serviceCharge: z.number().nullable(),
  paymentMethod: z.string().nullable(),
  receiptNumber: z.string().nullable(),
  merchantType: z.string().nullable(),
  tips: z.number().nullable(),
  discount: z.number().nullable(),
  loyaltyNumber: z.string().nullable(),
  tableNumber: z.string().nullable(),
  serverName: z.string().nullable(),
  orderNumber: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  website: z.string().nullable(),
  vatNumber: z.string().nullable(),
  timeOfDay: z.string().nullable(),
  customerCount: z.number().nullable(),
  specialOffers: z.string().nullable(),
  deliveryFee: z.number().nullable(),
  packagingFee: z.number().nullable(),
});

export type ItemModifier = z.infer<typeof itemModifierSchema>;
export type ReceiptData = z.infer<typeof receiptDataSchema>;

export type { TokenUsage };

export interface ReceiptAnalysisResult {
  data: ReceiptData;
  usage: TokenUsage;
}

/** Upper bound on the whole vision call, retries included. Keeps processing inside the routes' maxDuration. */
const VISION_TIMEOUT_MS = 50_000;
/** Upper bound on downloading the receipt image from blob storage. */
const IMAGE_FETCH_TIMEOUT_MS = 15_000;

/**
 * Normalise a model-supplied date to YYYY-MM-DD, or null if it is not a real calendar date.
 *
 * The schema accepts any string, and a value like "15/09/2026" used to be stored verbatim — which
 * then made the insights routes' TO_DATE(... 'YYYY-MM-DD') throw and 500 for that user.
 */
export function normalizeReceiptDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(m) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return `${y}-${m}-${d}`;
}

export interface SpendingInsight {
  summary: string;
  usage: TokenUsage;
}

/**
 * Read a receipt image into structured data, with the model lib/ai-model.ts picks for receipts.
 *
 * Used by every processing channel through lib/receipt-processing.ts.
 */
export async function analyzeReceiptImage(
  imageUrl: string,
  userEmail: string,
  userId: string,
  correlationId: CorrelationId,
  options: { model?: string } = {},
): Promise<ReceiptAnalysisResult> {
  submitLogEvent('receipt-process', 'Fetching image for analysis', correlationId, { imageUrl, userId });

  const inputImageRes = await fetch(imageUrl, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) });
  if (!inputImageRes.ok) {
    throw new Error(`Failed to download image: ${inputImageRes.statusText}`);
  }

  const contentType = inputImageRes.headers.get('content-type');
  const inputImageBuffer = await inputImageRes.arrayBuffer();

  const buffer = Buffer.from(inputImageBuffer);
  const mimeType = contentType || 'image/png';

  const model = modelFor('receipt', options.model);
  submitLogEvent('receipt-process', `Reading receipt with ${model}`, correlationId, { userId, model });

  // Get current date for context
  const currentDate = new Date().toISOString().split('T')[0];

  let result;
  try {
    result = await generateText({
      model,
      output: Output.object({ schema: receiptDataSchema, name: 'receipt' }),
      providerOptions: gatewayOptions('receipt', options.model),
      // Without these a slow or failing call retried twice with no deadline, running past the
      // route's maxDuration and leaving the receipt wedged in 'processing'.
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(VISION_TIMEOUT_MS),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Today's date is ${currentDate}. Analyze this image and extract receipt information.

FIRST: Determine if this is actually a receipt, invoice, or purchase-related document.
- Set isReceipt to TRUE for: receipts, invoices, bills, purchase orders, payment confirmations
- Set isReceipt to FALSE for: screenshots, memes, random photos, documents unrelated to purchases, text messages, social media posts, articles, etc.

If isReceipt is FALSE, you can skip detailed extraction (but still try to identify what the image contains in the merchant field for context).

REQUIRED FIELDS:
- isReceipt: boolean - whether this is actually a receipt/invoice/purchase document
- merchant: merchant/store name (or description of image content if not a receipt)
- total: total amount (number)
- currency: currency code (e.g., "GBP", "USD", "EUR")
- date: the date of the transaction or document itself (format as YYYY-MM-DD): "Date", "Transaction date", "Invoice date", "Bill date". NOT a due date, which is when a payment is still to be made. If no date is visible, use today's date: ${currentDate}
  Irish, UK and European receipts write dates day first: 09/10/2026 is 9 October 2026, not 10 September. Read a numeric date month first only if the receipt is clearly from the US (dollar prices, a US address). A date in the future, or a long way before today, is usually a misread.
- documentKind: "receipt" for proof of a payment already made (a till receipt, a payment confirmation, an order receipt); "bill" for a bill, statement or invoice asking for a payment not made yet (it has an amount due or a due date); "other" for anything else
- category: spending category based on merchant and items (choose from: "groceries", "dining", "transportation", "shopping", "entertainment", "healthcare", "utilities", "travel", "gas", "coffee", "pharmacy", "clothing", "electronics", "home", "other")

DETAILED EXTRACTION:
- items: array of objects with:
  * name: item name
  * quantity: quantity (number, default 1)
  * price: TOTAL price for this line item (number)
  * category: item category (optional)
  * description: brief description (optional)
  * modifiers: array of sub-items/modifiers (optional), each with:
    - name: modifier name (e.g., "Deposit", "Extra Cheese", "Discount")
    - price: modifier price (number, can be negative for discounts)
    - type: "fee" | "deposit" | "discount" | "addon" | "modifier"
  
  IMPORTANT: Handle indented sub-items correctly:
  - Deposit fees (e.g., "Deposit 15¢" under a beverage item)
  - Item-specific discounts (e.g., "-$2.00 Sale" under an item)
  - Modifiers/add-ons (e.g., "Extra Cheese $1.50" under a sandwich)
  - The main item price should be the final price INCLUDING all modifiers
  - List modifiers separately in the modifiers array for transparency

- location: store location/address (full address if visible)
- subtotal: subtotal amount before tax and service charges (number, if visible)
- tax: tax amount (number, if visible)
- serviceCharge: service charge/fees amount (number, if visible)
- paymentMethod: payment method used (e.g., "Card", "Cash", "Contactless", "Chip & PIN", "Apple Pay", "Google Pay", "Debit", "Credit")
- receiptNumber: receipt or transaction number
- merchantType: type of business (e.g., "restaurant", "grocery_store", "gas_station", "pharmacy", "retail", "coffee_shop", "fast_food", "department_store", "convenience_store", "supermarket", "other")

ADDITIONAL DETAILS:
- tips: tip amount (number, if visible)
- discount: discount amount (number, if visible)
- loyaltyNumber: loyalty card or member number
- tableNumber: table number for restaurants
- serverName: server or cashier name
- orderNumber: order number (different from receipt number)
- phoneNumber: merchant phone number
- website: merchant website
- vatNumber: VAT registration number
- timeOfDay: time of transaction (HH:MM format)
- customerCount: number of customers/covers (for restaurants)
- specialOffers: any special offers or promotions mentioned
- deliveryFee: delivery fee (if applicable)
- packagingFee: packaging fee (if applicable)

SMART CATEGORIZATION RULES:
- "groceries": Supermarkets, food stores, grocery chains
- "dining": Restaurants, cafes, bars, pubs (not coffee shops)
- "coffee": Coffee shops, cafes focused on coffee/beverages
- "gas": Gas stations, fuel, automotive
- "transportation": Parking, transit, taxi, uber, public transport
- "shopping": Retail stores, clothing, electronics, general merchandise
- "pharmacy": Pharmacies, drugstores, medical supplies
- "healthcare": Hospitals, clinics, medical services
- "entertainment": Movies, games, events, recreation
- "utilities": Bills, services, subscriptions
- "travel": Hotels, flights, travel services
- "home": Home improvement, furniture, household items

Extract all numeric values as numbers (not strings).`,
          },
          {
            type: 'image',
            image: buffer,
            mediaType: mimeType,
          },
        ],
      },
    ],
  });
  } catch (error) {
    // Log detailed debug info for schema validation failures
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails: Record<string, unknown> = {
      userId,
      userEmail,
      imageUrl,
      mimeType,
      imageSize: buffer.length,
      errorMessage,
    };

    // Check if this is a NoObjectGeneratedError from the AI SDK
    if (error && typeof error === 'object' && 'text' in error) {
      // The raw text response that failed to parse
      errorDetails.rawResponse = (error as { text?: string }).text;
    }

    // Include the cause if present (often contains validation details)
    if (error instanceof Error && error.cause) {
      errorDetails.errorCause = error.cause;
    }

    // Include the full error object for debugging
    if (error && typeof error === 'object') {
      errorDetails.errorName = (error as Error).name;
      errorDetails.errorStack = (error as Error).stack;
      // Check for Zod validation errors
      if ('issues' in error) {
        errorDetails.zodIssues = (error as { issues: unknown }).issues;
      }
    }

    submitLogEvent('receipt-error', `OpenAI schema validation failed: ${errorMessage}`, correlationId, errorDetails, true);

    throw error;
  }

  const usage = toTokenUsage(result.usage, result.providerMetadata);
  submitLogEvent('receipt-process', 'Receipt read', correlationId, {
    ...usage,
    model,
    servedBy: result.response.modelId,
    userId,
  });

  // Log the full extracted receipt data for debugging
  submitLogEvent('receipt-analysis-result', 'Full receipt analysis data extracted', correlationId, {
    userId,
    userEmail,
    extractedData: result.output,
    itemCount: result.output.items?.length || 0,
    rawItemCount: result.output.rawItems?.length || 0,
  });

  return {
    data: {
      ...result.output,
      date: normalizeReceiptDate(result.output.date),
    },
    usage,
  };
}


/**
 * The written spending summary on Insights, with the model lib/ai-model.ts picks for summaries.
 */
export async function generateSpendingSummary(
  aggregatedData: {
    period: string;
    totalItems: number;
    totalSpent: string;
    currency: string;
    topItems: Array<{ name: string; count: number }>;
    topCategories: Array<{ category: string; total: number }>;
    topMerchants: Array<{ merchant: string; total: number }>;
  },
  userEmail: string,
  userId: string,
  correlationId: CorrelationId,
): Promise<SpendingInsight> {
  submitLogEvent('receipt', 'Generating AI spending summary', correlationId, {
    userId,
    totalItems: aggregatedData.totalItems,
    totalSpent: aggregatedData.totalSpent,
  });

  const money = (amount: number | string) => {
    const value = typeof amount === 'number' ? amount : Number(amount);
    if (!Number.isFinite(value)) return `${aggregatedData.currency} ${amount}`;
    try {
      return new Intl.NumberFormat('en-IE', { style: 'currency', currency: aggregatedData.currency }).format(value);
    } catch {
      return `${aggregatedData.currency} ${value.toFixed(2)}`;
    }
  };

  const model = modelFor('summary');
  const result = await generateText({
    model,
    providerOptions: gatewayOptions('summary'),
    system: 'You are a helpful financial advisor analyzing spending patterns. Provide insights, identify trends, and offer actionable advice. Be concise but insightful. Use a friendly, conversational tone.',
    // Amounts formatted as the app shows them ("€200.10"): given "EUR 200.1", the summary wrote
    // money that way too.
    prompt: `Analyze this spending data and provide a summary with insights and recommendations:

Period: ${aggregatedData.period}
Total Items Purchased: ${aggregatedData.totalItems}
Total Spent: ${money(aggregatedData.totalSpent)}

Top 10 Most Frequently Purchased Items:
${aggregatedData.topItems.map((item, i) => `${i + 1}. ${item.name} (${item.count} times)`).join('\n')}

Top 5 Spending Categories:
${aggregatedData.topCategories.map((cat, i) => `${i + 1}. ${cat.category}: ${money(cat.total)}`).join('\n')}

Top 5 Merchants:
${aggregatedData.topMerchants.map((m, i) => `${i + 1}. ${m.merchant}: ${money(m.total)}`).join('\n')}

Please provide:
1. A brief overview of spending patterns
2. Key insights about purchasing habits
3. Potential areas for savings
4. Any notable trends or patterns
5. 2-3 actionable recommendations

Keep the response under 300 words and format it in a friendly, easy-to-read way.`,
    maxOutputTokens: 500,
    temperature: 0.7,
  });

  const usage = toTokenUsage(result.usage, result.providerMetadata);
  submitLogEvent('receipt', 'AI spending summary generated', correlationId, {
    ...usage,
    model,
    servedBy: result.response.modelId,
    userId,
    summaryText: result.text.trim(),
  });

  return {
    summary: result.text.trim(),
    usage,
  };
}


