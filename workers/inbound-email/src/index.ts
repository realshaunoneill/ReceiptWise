/**
 * ReceiptWise inbound email: a Cloudflare Email Worker on in.receiptwise.io.
 *
 * Every message to <token>@in.receiptwise.io comes here (an Email Routing catch-all on that
 * subdomain only; the apex MX stays with Migadu). For each one:
 *
 *   1. The token is the local part (before any +) of the envelope recipient: the address the mail
 *      was sent or forwarded to. Never the From or To headers.
 *   2. Ask the app (POST /api/webhooks/inbound-email/start) whether to take it. The app finds the
 *      user by the token and claims the message once; unknown addresses, repeats and accounts
 *      without Premium are refused or dropped.
 *   3. Upload the raw message straight to the app's private Blob store with the single-path client
 *      token the app returned, so its size isn't capped by Vercel's 4.5 MB request body.
 *   4. Tell the app it's there (POST /api/webhooks/inbound-email/stored), which reads it.
 *
 * If the app can't be reached, the message is forwarded to FALLBACK_ADDRESS so nothing is lost.
 */

import { put } from '@vercel/blob/client';

interface Env {
  APP_URL: string;
  INBOUND_DOMAIN: string;
  FALLBACK_ADDRESS: string;
  INBOUND_WORKER_SECRET: string;
}

const TOKEN = /^[a-z2-7]{26}$/;

type StartResult =
  | { action: 'store'; emailId: string; pathname: string; clientToken: string }
  | { action: 'drop' }
  | { action: 'reject'; reason?: string };

async function post<T>(env: Env, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${env.APP_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.INBOUND_WORKER_SECRET}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} answered ${res.status}`);
  return res.json() as Promise<T>;
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const [local = '', domain = ''] = message.to.toLowerCase().split('@');
    const token = local.split('+')[0];
    if (domain !== env.INBOUND_DOMAIN.toLowerCase() || !TOKEN.test(token)) {
      message.setReject('Unknown address');
      return;
    }

    try {
      const raw = await new Response(message.raw).arrayBuffer();
      const messageKey = message.headers.get('message-id')?.trim() || `sha256:${hex(await crypto.subtle.digest('SHA-256', raw))}`;

      const start = await post<StartResult>(env, '/api/webhooks/inbound-email/start', {
        token,
        messageKey,
        sizeBytes: raw.byteLength,
        from: message.from,
        subject: message.headers.get('subject'),
      });
      if (start.action === 'drop') return;
      if (start.action === 'reject') {
        message.setReject(start.reason || 'Not accepted');
        return;
      }

      // The client token fixes the pathname, size limit and overwrite rules.
      await put(start.pathname, raw, {
        access: 'private',
        token: start.clientToken,
        contentType: 'message/rfc822',
      });
      await post(env, '/api/webhooks/inbound-email/stored', { emailId: start.emailId });
    } catch (error) {
      console.error('inbound-email: handing over failed, forwarding to the fallback mailbox', error);
      await message.forward(env.FALLBACK_ADDRESS);
    }
  },
};
