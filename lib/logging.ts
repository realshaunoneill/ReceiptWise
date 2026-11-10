/* eslint-disable @typescript-eslint/no-explicit-any */
import { waitUntil } from '@vercel/functions';


export type EventType =
  | 'ratelimit'
  | 'generate'
  | 'generate-complete'
  | 'generate-error'
  | 'generate-retry'
  | 'credits'
  | 'cache'
  | 'pricing'
  | 'cache-error'
  | 'image'
  | 'user'
  | 'image-proxy'
  | 'image-metadata'
  | 'users'
  | 'stripe'
  | 'purchases'
  | 'upload'
  | 'receipt'
  | 'billing-portal'
  | 'receipt-process'
  | 'receipt-process-start'
  | 'receipt-process-complete'
  | 'receipt-upload'
  | 'receipt-upload-start'
  | 'receipt-upload-token'
  | 'receipt-upload-blob-complete'
  | 'receipt-upload-complete'
  | 'receipt-db-created'
  | 'receipt-status-processing'
  | 'receipt-analysis-result'
  | 'receipt-error'
  | 'receipt-retry'
  | 'database'
  | 'auth'
  | 'household'
  | 'invitation'
  | 'checkout'
  | 'subscription'
  | 'admin'
  | 'api-key'
  | 'extension-upload'
  | 'app-upload'
  | 'push'
  | 'app-error'
  | 'extension-process'
  | 'finance'
  | 'plan'
  | 'bill-document'
  | 'inbound-email'
  | 'billing'
  | 'email'
  | 'cron';
export type CorrelationId = `${string}-${string}-${string}-${string}-${string}`;

const LOG_TOKEN = process.env.LOG_TOKEN;
const LOG_REGION = process.env.LOG_REGION;

const simpleLog = (
  event: EventType,
  logLine: string,
  correlationId: CorrelationId | null,
  data?: { [key: string]: any },
) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`DEBUG: Log ${event}:`, logLine, correlationId, data);
  } else {
    console.log(`Log ${event}:`, logLine);
  }
};

/*
 * Email addresses are stripped before anything leaves the process. Call sites put `email`,
 * `userEmail` and the like into payloads, and interpolate addresses into messages; `userId` is
 * already on every event and is enough to debug with. Doing it here, at the one sink, means a
 * new call site cannot reintroduce the leak.
 */
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const EMAIL_KEY_PATTERN = /e-?mail/i;

/*
 * The same goes for what's in a receipt and where its picture is. A receipt image's public URL is
 * a bearer link to it, and a receipt's items, notes and the model's raw output are the customer's
 * spending; ids and counts are enough to debug with.
 */
const IMAGE_URL_PATTERN = /https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/\S*/gi;
const CONTENT_KEY_PATTERN = /^(imageUrl|imageUrls|extractedData|businessNotes|notes|items|rawItems|rawText|rawResponse|output)$/i;

function redactString(value: string): string {
  return value.replace(EMAIL_PATTERN, '[email]').replace(IMAGE_URL_PATTERN, '[image-url]');
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return redactString(value);
  if (depth > 4 || value === null || typeof value !== 'object' || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, v]) => [
      key,
      EMAIL_KEY_PATTERN.test(key) ? '[email]' : CONTENT_KEY_PATTERN.test(key) ? '[omitted]' : redactValue(v, depth + 1),
    ]),
  );
}

export const submitLogEvent =(
    event: EventType,
    rawLogLine: string,
    correlationId: CorrelationId | null,
    rawData?: Record<string, unknown>,
    alert = false,
  ) => {
    const logLine = redactString(rawLogLine);
    const data = rawData ? (redactValue(rawData) as Record<string, unknown>) : undefined;

    const logEvent = async () => {
      try {
        simpleLog(event, logLine, correlationId, data);

        if ((!LOG_TOKEN || !LOG_REGION) || process.env.NODE_ENV === 'development') {
          return true;
        }

        const response = await fetch(`https://${LOG_REGION.toLowerCase()}.webhook.logs.insight.rapid7.com/v1/noformat/${LOG_TOKEN}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // The flag call sites already pass for failures, so the log can be searched and
            // alerted on by level ("where(level=error)").
            level: alert ? 'error' : 'info',
            event,
            message: logLine,
            correlationId,
            data,
          }),
        });

        if (!response.ok) {
          console.error('Failed to log event', response.statusText);
        }

        if (alert) {
          await submitAlert(event, logLine, correlationId, data);
        }

        return true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to log event', errorMessage);

        return false;
      }
    };

    // Keeps the function alive until the line is sent: a bare promise is cut off when a response
    // returns, which loses exactly the last lines before it (and outside Vercel it just runs).
    waitUntil(logEvent());
};

/*
 * Failures (call sites pass alert=true) also go to a Discord channel when ALERT_DISCORD_WEBHOOK is
 * set on Vercel, so a broken webhook, cron or checkout is seen the day it happens rather than when
 * a customer writes in. The same line is sent at most once per instance per 15 minutes, so a burst
 * of the same error is one message.
 */
const ALERT_WEBHOOK = process.env.ALERT_DISCORD_WEBHOOK;
const ALERT_QUIET_MS = 15 * 60 * 1000;
const lastAlerted = new Map<string, number>();

const submitAlert = async (
  event: EventType,
  logLine: string,
  correlationId: CorrelationId | null,
  data?: Record<string, unknown>,
) => {
  if (!ALERT_WEBHOOK) return;
  try {
    // Numbers and ids vary between otherwise identical errors, so they're not part of the key.
    const key = `${event}:${logLine.replace(/[0-9a-f-]{8,}|\d+/gi, '#').slice(0, 160)}`;
    const now = Date.now();
    if (now - (lastAlerted.get(key) ?? 0) < ALERT_QUIET_MS) return;
    lastAlerted.set(key, now);

    const where = process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production' ? ` (${process.env.VERCEL_ENV})` : '';
    const content = [
      `🚨 **ReceiptWise${where}: ${event}**`,
      logLine.slice(0, 1500),
      data?.userId ? `User: \`${String(data.userId)}\`` : null,
      correlationId ? `Correlation: \`${correlationId}\`` : null,
    ].filter(Boolean).join('\n');

    const response = await fetch(ALERT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // No @everyone or role pings, whatever an error message happens to contain.
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) console.error('Failed to send alert', response.status);
  } catch (error) {
    console.error('Failed to send alert:', error);
  }
};
