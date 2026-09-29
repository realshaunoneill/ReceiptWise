/* eslint-disable @typescript-eslint/no-explicit-any */


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
  | 'extension-process';
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

function redactValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return value.replace(EMAIL_PATTERN, '[email]');
  if (depth > 4 || value === null || typeof value !== 'object' || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, v]) => [
      key,
      EMAIL_KEY_PATTERN.test(key) ? '[email]' : redactValue(v, depth + 1),
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
    const logLine = rawLogLine.replace(EMAIL_PATTERN, '[email]');
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

    void logEvent();
};

const submitAlert = async (
  event: EventType,
  logLine: string,
  correlationId: CorrelationId | null,
  data?: Record<string, unknown>,
) => {
  try {
    const _message = `🚨 <b>${event.toUpperCase()}</b>\n` +
      `Message: ${logLine}\n` +
      (data?.userId ? `User ID: <pre>${data.userId}</pre>` : '');

    // await sendTelegramAlert(message);
  } catch (error) {
    console.error('Failed to send alert:', error);
  }
};
