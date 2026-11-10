import { type CorrelationId, submitLogEvent } from '@/lib/logging';

/*
 * Service email: messages about the person's own account, never marketing (the privacy policy
 * says "We do not send marketing email"). Sent through Resend's HTTP API, with no SDK.
 *
 * Set up 2026-11-10, production only: EMAIL_FROM "ReceiptWise <hello@mail.receiptwise.io>", and a
 * RESEND_API_KEY that can only send, and only from mail.receiptwise.io (a copy is on cevo as
 * RECEIPTWISE_RESEND_API_KEY). The domain is in the EU region on the Resend team AutoToonify and
 * PawToonify use (a team of its own is a paid feature), with DKIM, SPF and the bounce MX on
 * Cloudflare and no open or click tracking. The apex MX stays with the support mailbox.
 *
 * Without both variables (previews, local) every send answers 'off' and callers carry on: the page
 * they came from already shows what the email would have said.
 */

export type EmailResult = 'sent' | 'off' | 'failed';

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export async function sendServiceEmail(
  message: { to: string; subject: string; text: string; idempotencyKey?: string },
  correlationId: CorrelationId,
): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return 'off';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Resend keeps these for 24 hours, so a retried request can't send the same email twice.
        ...(message.idempotencyKey && { 'Idempotency-Key': message.idempotencyKey }),
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        reply_to: 'support@receiptwise.io',
        subject: message.subject,
        text: message.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      submitLogEvent('email', `Email "${message.subject}" was refused: ${response.status}`, correlationId, { status: response.status }, true);
      return 'failed';
    }
    return 'sent';
  } catch (error) {
    submitLogEvent('email', `Email "${message.subject}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return 'failed';
  }
}
