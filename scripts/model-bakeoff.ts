/**
 * Compare models for reading receipts and bills, through the production code paths.
 *
 *   LOG_TOKEN= npx dotenv -e .env.local -- npx tsx scripts/model-bakeoff.ts [model ...]
 *
 * Runs every fixture in scripts/bakeoff-fixtures through analyzeReceiptImage / analyzeBillDocument
 * with each model (through the AI Gateway, so AI_GATEWAY_API_KEY must be set) and scores the
 * result against truth.json. Costs are what the gateway reports it charged, not the price list:
 * image tokenisation differs so much between models that rates don't predict cost per document.
 *
 * The fixtures are synthetic (no real person's receipts): each receipt clean and "photographed"
 * (rotated, soft, unevenly lit, heavy JPEG), and bills as PDFs, a photo and email text. Clear
 * LOG_TOKEN so the extractions aren't sent to the log sink.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeBillDocument } from '../lib/bill-extraction';
import { type CorrelationId } from '../lib/logging';
import { analyzeReceiptImage } from '../lib/receipt-ai';

const DIR = join(process.cwd(), 'scripts/bakeoff-fixtures');

const DEFAULT_MODELS = [
  'openai/gpt-4o',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'google/gemini-3.1-flash-lite',
  'google/gemini-3.8-flash',
  'anthropic/claude-haiku-5.5',
  'openai/gpt-4.1-mini',
  'openai/gpt-5-mini',
  'openai/gpt-5-nano',
];

type ReceiptTruth = { file: string; merchant: string; total: number; date: string; currency: string; itemCount: number; itemsSum: number };
type BillTruth = { file: string; provider: string; documentType: string; amountDue: number | null; dueDate: string | null; minimumPayment?: number; isDirectDebit?: boolean };

const truth = JSON.parse(readFileSync(join(DIR, 'truth.json'), 'utf8')) as { receipts: ReceiptTruth[]; bills: BillTruth[] };

const norm = (value: unknown) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
const near = (a: unknown, b: number, tolerance = 0.011) => typeof a === 'number' && Math.abs(a - b) < tolerance;
const mime = (file: string) => (file.endsWith('.png') ? 'image/png' : file.endsWith('.jpg') ? 'image/jpeg' : file.endsWith('.pdf') ? 'application/pdf' : 'text/plain');

type Outcome = { ok: boolean; keyOk: boolean; misses: string[]; costUsd?: number; ms: number; error?: string };

async function scoreReceipt(model: string, t: ReceiptTruth): Promise<Outcome> {
  const started = Date.now();
  try {
    const bytes = readFileSync(join(DIR, t.file));
    const url = `data:${mime(t.file)};base64,${bytes.toString('base64')}`;
    const { data, usage } = await analyzeReceiptImage(url, 'bakeoff@receiptwise.test', 'bakeoff', `bakeoff-${t.file}` as CorrelationId, { model });
    const items = data.items ?? [];
    const itemsSum = Math.round(items.reduce((sum, item) => sum + (item.price ?? 0), 0) * 100) / 100;
    const misses = [
      !near(data.total, t.total) && `total ${data.total}≠${t.total}`,
      data.date !== t.date && `date ${data.date}≠${t.date}`,
      norm(data.currency) !== norm(t.currency) && `currency ${data.currency}`,
      !(norm(data.merchant).includes(norm(t.merchant).slice(0, 6)) || norm(t.merchant).includes(norm(data.merchant))) && `merchant ${data.merchant}`,
      items.length !== t.itemCount && `items ${items.length}≠${t.itemCount}`,
      !near(itemsSum, t.itemsSum, 0.05) && `itemsSum ${itemsSum}≠${t.itemsSum}`,
    ].filter(Boolean) as string[];
    const keyOk = !misses.some((miss) => /^(total|date|currency|merchant)/.test(miss));
    return { ok: misses.length === 0, keyOk, misses, costUsd: usage.costUsd, ms: Date.now() - started };
  } catch (error) {
    return { ok: false, keyOk: false, misses: ['error'], ms: Date.now() - started, error: error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 160) : String(error) };
  }
}

async function scoreBill(model: string, t: BillTruth): Promise<Outcome> {
  const started = Date.now();
  try {
    const bytes = readFileSync(join(DIR, t.file));
    const type = mime(t.file);
    const input = type === 'text/plain'
      ? { kind: 'text' as const, text: bytes.toString('utf8') }
      : { kind: 'file' as const, bytes, mimeType: type, fileName: t.file };
    const { data, usage } = await analyzeBillDocument(input, { userId: 'bakeoff', documentId: t.file, correlationId: `bakeoff-${t.file}` as CorrelationId, model });
    const misses = [
      norm(data.documentType) !== norm(t.documentType) && `type ${data.documentType}`,
      t.amountDue === null ? data.amountDue !== null && `amount ${data.amountDue}≠none` : !near(data.amountDue, t.amountDue) && `amount ${data.amountDue}≠${t.amountDue}`,
      data.dueDate !== t.dueDate && `due ${data.dueDate}≠${t.dueDate}`,
      t.minimumPayment !== undefined && !near(data.minimumPayment, t.minimumPayment) && `minimum ${data.minimumPayment}≠${t.minimumPayment}`,
      t.provider && !norm(data.provider).includes(norm(t.provider).slice(0, 3)) && `provider ${data.provider}`,
    ].filter(Boolean) as string[];
    return { ok: misses.length === 0, keyOk: misses.length === 0, misses, costUsd: usage.costUsd, ms: Date.now() - started };
  } catch (error) {
    return { ok: false, keyOk: false, misses: ['error'], ms: Date.now() - started, error: error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 160) : String(error) };
  }
}

async function pool<T, R>(items: T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index]);
    }
  }));
  return results;
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

async function main() {
  const models = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_MODELS;
  const rows: string[] = [];
  const detail: string[] = [];
  await pool(models, 3, async (model) => {
    const receipts = await pool(truth.receipts, 5, (t) => scoreReceipt(model, t));
    const bills = await pool(truth.bills, 5, (t) => scoreBill(model, t));
    const clean = receipts.filter((_, i) => truth.receipts[i].file.includes('-clean'));
    const photo = receipts.filter((_, i) => truth.receipts[i].file.includes('-photo'));
    const count = (list: Outcome[], key: 'ok' | 'keyOk') => `${list.filter((o) => o[key]).length}/${list.length}`;
    const receiptCost = mean(receipts.map((o) => o.costUsd).filter((c): c is number => typeof c === 'number'));
    const billCost = mean(bills.map((o) => o.costUsd).filter((c): c is number => typeof c === 'number'));
    rows.push([
      model.padEnd(30),
      `key clean ${count(clean, 'keyOk')}  photo ${count(photo, 'keyOk')}`,
      `all fields ${count(receipts, 'ok')}`,
      `bills ${count(bills, 'ok')}`,
      `$/receipt ${receiptCost.toFixed(5)}  $/bill ${billCost.toFixed(5)}`,
      `p50 ${(median(receipts.map((o) => o.ms)) / 1000).toFixed(1)}s`,
      `errors ${[...receipts, ...bills].filter((o) => o.error).length}`,
    ].join(' | '));
    receipts.forEach((o, i) => { if (!o.ok) detail.push(`${model} ${truth.receipts[i].file}: ${o.error ?? o.misses.join(', ')}`); });
    bills.forEach((o, i) => { if (!o.ok) detail.push(`${model} ${truth.bills[i].file}: ${o.error ?? o.misses.join(', ')}`); });
  });
  console.log('\nRESULTS (key = merchant, total, date, currency; all fields adds item count and item sum)');
  for (const row of rows.sort()) console.log(row);
  console.log('\nMISSES');
  for (const line of detail.sort()) console.log(line);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
