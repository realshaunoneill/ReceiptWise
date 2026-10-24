import type { GatewayProviderOptions } from '@ai-sdk/gateway';

/**
 * Which model does each AI job, through the Vercel AI Gateway.
 *
 * A model is a `provider/model` string, so switching one is an env var rather than a code change,
 * and each job names fallbacks the gateway tries in order if the first provider errors or is down.
 * The gateway authenticates with AI_GATEWAY_API_KEY, or the deployment's OIDC token on Vercel.
 *
 * Compare models on measured cost per document, never on the price list: image tokenisation varies
 * enormously between models (gpt-4o-mini billed ~20x the input tokens gpt-4o did for the same
 * receipt photo). scripts/model-bakeoff.ts runs the comparison; its results are below.
 */

export type AiTask = 'receipt' | 'bill' | 'summary';

type ModelChoice = {
  /** The model used first. */
  model: string;
  /** Tried in order if it fails. */
  fallbacks: string[];
  /** Override with this env var, e.g. RECEIPTWISE_RECEIPT_MODEL=google/gemini-2.5-flash. */
  env: string;
};

/*
 * Measured 2026-10-24 with scripts/model-bakeoff.ts: 10 synthetic receipts, each clean and
 * "photographed" (rotated, soft, unevenly lit, JPEG 40), and 5 bills (2 PDFs, a photo, 2 emails),
 * through the gateway with zero data retention on. "All fields" is merchant, total, date,
 * currency, item count and the items adding up; costs are what the gateway charged.
 *
 *   model                          receipts   bills   $/receipt   p50
 *   google/gemini-2.5-flash-lite      20/20     5/5     0.00050   2.5s   (3 runs, all 20/20)
 *   google/gemini-3.1-flash-lite      20/20     5/5     0.00216   2.6s   (3 runs, all 20/20)
 *   google/gemini-2.5-flash           20/20     5/5     0.00554   7.9s
 *   openai/gpt-5-mini                 20/20     5/5     0.00357  17.5s
 *   openai/gpt-4o (until now)         18/20     5/5     0.01037   3.6s   item lists wrong on 2 photos
 *   openai/gpt-4.1-mini               18/20     4/5     0.00168   3.7s   US date read day-first
 *   openai/gpt-5-nano                 18/20     4/5     0.00160  20.7s
 *   google/gemini-3.8-flash           13/20     3/5     0.00653  18.8s   timed out
 *   anthropic/claude-haiku-5.5         4/20     5/5     0.00105   3.4s   output didn't fit the schema
 *
 * So Flash-Lite reads receipts and bills for a twentieth of gpt-4o's cost, and better. 3.1
 * Flash-Lite is the fallback (as accurate, a newer generation, so not retired at the same time),
 * then gpt-4o. It also writes the spending summary well, for about $0.00016, which keeps Google
 * the only provider besides OpenAI.
 */
const MODELS: Record<AiTask, ModelChoice> = {
  // Reading a receipt photo into structured data, on every upload.
  receipt: {
    model: 'google/gemini-2.5-flash-lite',
    fallbacks: ['google/gemini-3.1-flash-lite', 'openai/gpt-4o'],
    env: 'RECEIPTWISE_RECEIPT_MODEL',
  },
  // Reading a bill (PDF, photo, or an email's text) for the provider, amount and due date.
  bill: {
    model: 'google/gemini-2.5-flash-lite',
    fallbacks: ['google/gemini-3.1-flash-lite', 'openai/gpt-4o'],
    env: 'RECEIPTWISE_BILL_MODEL',
  },
  // The written spending summary on Insights, on request. Text in, prose out.
  summary: {
    model: 'google/gemini-2.5-flash-lite',
    fallbacks: ['openai/gpt-4o-mini'],
    env: 'RECEIPTWISE_SUMMARY_MODEL',
  },
};

/** The model for a job: an explicit override (scripts/model-bakeoff.ts), the env var, else the default. */
export function modelFor(task: AiTask, override?: string): string {
  const configured = override?.trim() || process.env[MODELS[task].env]?.trim();
  return configured || MODELS[task].model;
}

/**
 * Gateway options for a call: the fallbacks, and two privacy filters that cost nothing extra.
 *
 * - zeroDataRetention: only providers with a zero-retention agreement, so receipts and bills
 *   aren't kept by whoever reads them.
 * - disallowPromptTraining: never a provider that trains on API prompts (the privacy policy says
 *   they aren't used for training).
 *
 * No `tags` or `user` for spend attribution: either adds a $0.000075 surcharge to every request
 * (measured 2026-10-24), about a quarter of what reading a receipt costs on a cheap model.
 */
export function gatewayOptions(task: AiTask, override?: string) {
  const model = modelFor(task, override);
  // An override (the bake-off) gets no fallbacks: a failure has to show as a failure.
  const fallbacks = override ? [] : [MODELS[task].model, ...MODELS[task].fallbacks].filter((candidate) => candidate !== model);
  // A plain JSON object (provider options must be JSON), checked against the gateway's own type.
  const gateway = {
    ...(fallbacks.length > 0 ? { models: fallbacks } : {}),
    zeroDataRetention: true,
    disallowPromptTraining: true,
  } satisfies GatewayProviderOptions;
  return { gateway };
}

/** Token counts and cost as stored with each receipt and bill (processing_tokens), whatever the model. */
export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** What the gateway charged, in US dollars, when it says. */
  costUsd?: number;
};

export function toTokenUsage(
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number },
  providerMetadata?: Record<string, Record<string, unknown> | undefined>,
): TokenUsage {
  const promptTokens = usage.inputTokens ?? 0;
  const completionTokens = usage.outputTokens ?? 0;
  const cost = Number(providerMetadata?.gateway?.cost);
  return {
    promptTokens,
    completionTokens,
    totalTokens: usage.totalTokens ?? promptTokens + completionTokens,
    ...(Number.isFinite(cost) ? { costUsd: cost } : {}),
  };
}
