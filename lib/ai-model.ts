/**
 * Which models do the work, and how to change them.
 *
 * Everything goes through Vercel's AI Gateway rather than a provider SDK, so a
 * model is a `provider/model` string and switching one is configuration rather
 * than a code change — same reasoning as Squint's `src/lib/ai-model.ts`. That is
 * the point of this file: the model becomes an env var you can flip and measure,
 * instead of an import you have to rewrite.
 *
 * The defaults below are unchanged from what the code used before the gateway
 * migration, deliberately. A cheaper default was the original goal, and it did not
 * survive measurement — see below.
 */

/**
 * Receipt extraction: vision, structured output, runs on every upload.
 *
 * Measured 2026-09-16 through this function, on a receipt with known values (6 line
 * items, total €24.46), in two conditions: a crisp render, and the same receipt
 * degraded to look photographed — rotated 3°, soft-focused, contrast crushed,
 * uneven lighting, JPEG quality 38. The rotation matters: it offsets every price
 * from its item name, which is the alignment problem real photos actually pose.
 *
 *   model                       clean   photographed   $/receipt   per 1k
 *   google/gemini-2.5-flash       4/4            2/2     0.00479    $4.79
 *   openai/gpt-4o                 4/4            2/2     0.00883    $8.83
 *   anthropic/claude-haiku-4.5    0/4              -     0.00859    $8.59
 *
 * Gemini 2.5 Flash is the default because it matched gpt-4o on every run and costs
 * 45% less. Rolling back is one env var.
 *
 * Two findings worth keeping:
 *
 * 1. Haiku 4.5 is not usable for this. It misread a line-item price on every run,
 *    identically at temperature 0 — a total of €23.26/€23.37 against a true €24.46 —
 *    on the *clean* image. Not a sampling wobble; a deterministic misread on the
 *    easiest possible input. And it was not even cheap: it spent 2,903 input tokens
 *    where gpt-4o spent 1,762, landing within 3% of gpt-4o's cost. Wrong and dear.
 *
 * 2. Per-token rates do not predict per-receipt cost, because image tokenisation
 *    varies enormously between models. `gpt-4o-mini` has a 17× lower rate than
 *    gpt-4o yet billed 8,632 input tokens for an image gpt-4o read in 387. Compare
 *    models on measured cost per receipt, never on the price list.
 *
 * Caveat on the evidence: this is one receipt in two renderings, not a corpus. It
 * does not cover thermal fade, handwriting, other languages, or a different chain's
 * layout. If extraction quality is ever questioned, re-run this comparison against
 * a spread of real receipts before trusting the table above.
 */
const DEFAULT_RECEIPT_MODEL = 'google/gemini-2.5-flash';

/**
 * Spending summary: text in, a paragraph out, only when a user asks for it.
 *
 * Left on `gpt-4o-mini` (~$0.15/$0.60 per MTok). It was already the cheap path, and
 * the image-tokenisation problem above does not apply — there is no image. Routing
 * it to Haiku "for consistency" would have multiplied this cost for prose.
 */
const DEFAULT_SUMMARY_MODEL = 'openai/gpt-4o-mini';

function resolve(configured: string | undefined, fallback: string): string {
  const trimmed = configured?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Model used to read a receipt image into structured data.
 * Override with `RECEIPTWISE_RECEIPT_MODEL`, e.g. `google/gemini-2.5-flash`.
 */
export function receiptModelId(): string {
  return resolve(process.env.RECEIPTWISE_RECEIPT_MODEL, DEFAULT_RECEIPT_MODEL);
}

/** Model used to write the spending summary. Override with `RECEIPTWISE_SUMMARY_MODEL`. */
export function summaryModelId(): string {
  return resolve(process.env.RECEIPTWISE_SUMMARY_MODEL, DEFAULT_SUMMARY_MODEL);
}

/**
 * Whether either model has been overridden. Logged with each call, so a run that
 * behaved oddly can be traced to a model swap rather than to the code.
 */
export function isCustomModel(): boolean {
  return (
    receiptModelId() !== DEFAULT_RECEIPT_MODEL ||
    summaryModelId() !== DEFAULT_SUMMARY_MODEL
  );
}
