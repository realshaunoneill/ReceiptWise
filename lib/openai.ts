import { gateway, generateObject, generateText } from 'ai';
import { receiptModelId, summaryModelId } from '@/lib/ai-model';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { z } from 'zod';

/*
 * Zod schemas for type-safe AI responses.
 *
 * Every optional field here is `.nullable()` and deliberately NOT `.optional()` —
 * and nothing uses `.default()` either.
 * AI SDK 7 sends `generateObject` schemas to OpenAI in strict structured-output
 * mode, which requires every key in `properties` to also appear in `required`.
 * Both `.optional()` and `.default()` drop a key from `required`, so the request is
 * rejected outright:
 *
 *   Invalid schema for response_format 'response': ... 'required' is required to be
 *   supplied and to be an array including every key in properties. Missing 'quantity'.
 *
 * That is a 400 at call time, not a type error — it compiles and builds clean, so it
 * only shows up when a receipt is actually processed. `.nullable()` alone expresses
 * the same thing ("may have no value") in a form strict mode accepts.
 */
const itemModifierSchema = z.object({
  name: z.string(),
  price: z.number(),
  type: z.enum(['fee', 'deposit', 'discount', 'addon', 'modifier']),
});

const receiptItemSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable(),
  price: z.number(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  modifiers: z.array(itemModifierSchema).nullable(),
});

const receiptDataSchema = z.object({
  // `.default(true)` was removed for the same reason as `.optional()` below: a
  // defaulted key is omitted from `required`, which strict mode rejects. The prompt
  // instructs the model to always set this, so the default was never load-bearing.
  isReceipt: z.boolean().describe('Whether this image appears to be a receipt, invoice, or purchase-related document. False if it\'s a screenshot, meme, random image, etc.'),
  merchant: z.string().nullable(),
  total: z.number().nullable(),
  currency: z.string().nullable(),
  date: z.string().nullable(),
  category: z.string().nullable(),
  items: z.array(receiptItemSchema).nullable(),
  rawItems: z.array(z.object({
    name: z.string(),
    price: z.number(),
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

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ReceiptAnalysisResult {
  data: ReceiptData;
  usage: TokenUsage;
}

export interface SpendingInsight {
  summary: string;
  usage: TokenUsage;
}

/**
 * Analyze receipt image using GPT-4o-mini (for /api/receipt/process)
 * This is the main receipt processing function with full extraction
 * Using GPT-4o-mini for cost efficiency - structured data extraction works well with smaller models
 */
export async function analyzeReceiptWithGPT4o(
  imageUrl: string,
  userEmail: string,
  userId: string,
  correlationId: CorrelationId,
): Promise<ReceiptAnalysisResult> {
  submitLogEvent('receipt-process', 'Fetching image for analysis', correlationId, { imageUrl, userId });

  const inputImageRes = await fetch(imageUrl);
  if (!inputImageRes.ok) {
    throw new Error(`Failed to download image: ${inputImageRes.statusText}`);
  }

  const contentType = inputImageRes.headers.get('content-type');
  const inputImageBuffer = await inputImageRes.arrayBuffer();

  const buffer = Buffer.from(inputImageBuffer);
  const base64Image = buffer.toString('base64');
  const mimeType = contentType || 'image/png';

  const receiptModel = receiptModelId();
  submitLogEvent('receipt-process', `Extracting receipt with ${receiptModel}`, correlationId, { userId, userEmail, model: receiptModel });

  // Get current date for context
  const currentDate = new Date().toISOString().split('T')[0];

  // Routed through the AI Gateway so the model is configuration, not code. The
  // accuracy reasoning behind the original gpt-4o choice still holds — faded and
  // crumpled receipts are the hard case — which is why the default is a full
  // vision model rather than a mini tier. See lib/ai-model.ts.
  let result;
  try {
    result = await generateObject({
      model: gateway(receiptModel),
      schema: receiptDataSchema,
      // `metadata` was removed from experimental_telemetry in AI SDK 5. Nothing
      // is lost: every field it carried is already on the submitLogEvent calls
      // below. It also means userEmail is no longer handed to a second
      // destination, which was on the list to stop doing regardless.
      experimental_telemetry: {
        isEnabled: true,
        functionId: 'analyzeReceipt',
      },
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
- date: transaction date or invoice date (format as YYYY-MM-DD). Look for: "Date", "Due date", "Invoice date", "Transaction date", or any visible date on the document. If no date is visible, use today's date: ${currentDate}
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
            // AI SDK 7 deprecates the `image` content part in favour of a `file`
            // part with an explicit mediaType. The old form still works but logs a
            // deprecation warning on every receipt processed.
            type: 'file',
            mediaType: mimeType,
            data: base64Image,
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

  submitLogEvent('receipt-process', 'Model usage', correlationId, {
    promptTokens: result.usage.inputTokens ?? 0,
    completionTokens: result.usage.outputTokens ?? 0,
    totalTokens: result.usage.totalTokens ?? 0,
    model: receiptModel,
    userEmail,
    userId,
  });

  // Log the full extracted receipt data for debugging
  submitLogEvent('receipt-analysis-result', 'Full receipt analysis data extracted', correlationId, {
    userId,
    userEmail,
    extractedData: result.object,
    itemCount: result.object.items?.length || 0,
    rawItemCount: result.object.rawItems?.length || 0,
  });

  return {
    data: result.object,
    // Mapped rather than spread: AI SDK 5 renamed these to inputTokens /
    // outputTokens, but the object is stored in the receipts table as
    // `processingTokens`, so keeping the old keys avoids a JSON column with two
    // different shapes depending on when the row was written.
    usage: {
      promptTokens: result.usage.inputTokens ?? 0,
      completionTokens: result.usage.outputTokens ?? 0,
      totalTokens: result.usage.totalTokens ?? 0,
    },
  };
}


/**
 * Generate spending summary using GPT-4o Mini
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
  const summaryModel = summaryModelId();
  submitLogEvent('receipt', `Generating spending summary with ${summaryModel}`, correlationId, {
    userId,
    userEmail,
    totalItems: aggregatedData.totalItems,
    totalSpent: aggregatedData.totalSpent,
  });

  const result = await generateText({
    model: gateway(summaryModel),
    system: 'You are a helpful financial advisor analyzing spending patterns. Provide insights, identify trends, and offer actionable advice. Be concise but insightful. Use a friendly, conversational tone.',
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'generateSpendingSummary',
    },
    prompt: `Analyze this spending data and provide a summary with insights and recommendations:

Period: ${aggregatedData.period}
Total Items Purchased: ${aggregatedData.totalItems}
Total Spent: ${aggregatedData.currency} ${aggregatedData.totalSpent}

Top 10 Most Frequently Purchased Items:
${aggregatedData.topItems.map((item, i) => `${i + 1}. ${item.name} (${item.count} times)`).join('\n')}

Top 5 Spending Categories:
${aggregatedData.topCategories.map((cat, i) => `${i + 1}. ${cat.category}: ${aggregatedData.currency} ${cat.total}`).join('\n')}

Top 5 Merchants:
${aggregatedData.topMerchants.map((m, i) => `${i + 1}. ${m.merchant}: ${aggregatedData.currency} ${m.total}`).join('\n')}

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

  submitLogEvent('receipt', 'AI spending summary generated', correlationId, {
    promptTokens: result.usage.inputTokens ?? 0,
    completionTokens: result.usage.outputTokens ?? 0,
    totalTokens: result.usage.totalTokens ?? 0,
    model: summaryModel,
    userEmail,
    userId,
    summaryText: result.text.trim(),
  });

  return {
    summary: result.text.trim(),
    // Mapped rather than spread: AI SDK 5 renamed these to inputTokens /
    // outputTokens, but the object is stored in the receipts table as
    // `processingTokens`, so keeping the old keys avoids a JSON column with two
    // different shapes depending on when the row was written.
    usage: {
      promptTokens: result.usage.inputTokens ?? 0,
      completionTokens: result.usage.outputTokens ?? 0,
      totalTokens: result.usage.totalTokens ?? 0,
    },
  };
}


