import { type Email } from 'postal-mime';
import { BILL_MIME_TYPES } from '@/lib/storage/private-blob';

/**
 * What to read in a forwarded email: its PDF and image attachments (not logos and signature
 * images), or, when it has none, its text. And Gmail's forwarding confirmation, which has to be
 * clicked before a forwarding rule starts.
 */

export const MAX_PARTS = 5;
export const MAX_PART_BYTES = 10 * 1024 * 1024;
/** Inline images this small that the HTML references are logos, not bills. */
const SMALL_INLINE_IMAGE_BYTES = 20 * 1024;
export const MAX_TEXT_CHARS = 20_000;

export type EmailPart = { index: number; fileName: string; mimeType: string; bytes: Uint8Array };

function bytesOf(content: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (typeof content === 'string') return new TextEncoder().encode(content);
  return content instanceof Uint8Array ? content : new Uint8Array(content);
}

/** HTML to readable text: drop styles and scripts, turn breaks into newlines, strip tags and entities. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCharCode(Number(code)))
    .replace(/&euro;/g, '€')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

export function selectParts(email: Email): { parts: EmailPart[]; text: string | null } {
  const parts: EmailPart[] = [];
  for (const attachment of email.attachments) {
    const mimeType = attachment.mimeType.toLowerCase();
    if (!(BILL_MIME_TYPES as readonly string[]).includes(mimeType)) continue;
    const bytes = bytesOf(attachment.content);
    if (bytes.length === 0 || bytes.length > MAX_PART_BYTES) continue;
    const inline = attachment.related || attachment.disposition === 'inline' || Boolean(attachment.contentId);
    if (mimeType.startsWith('image/') && inline && bytes.length < SMALL_INLINE_IMAGE_BYTES) continue;
    parts.push({ index: parts.length, fileName: attachment.filename || `attachment-${parts.length + 1}`, mimeType, bytes });
    if (parts.length >= MAX_PARTS) break;
  }

  if (parts.length > 0) return { parts, text: null };
  const text = (email.text?.trim() || (email.html ? htmlToText(email.html) : '')).slice(0, MAX_TEXT_CHARS).trim();
  return { parts, text: text || null };
}

/**
 * Gmail's "(#123456789) Gmail Forwarding Confirmation" email, sent to the forwarding address when a
 * user adds it in Gmail. Its code and link are shown in Settings so the user can finish setting up.
 */
export function forwardingConfirmation(email: Email): { code: string | null; url: string | null } | null {
  const from = email.from?.address?.toLowerCase() ?? '';
  if (from !== 'forwarding-noreply@google.com') return null;
  const body = `${email.subject ?? ''}\n${email.text ?? (email.html ? htmlToText(email.html) : '')}`;
  const code = /confirmation code:\s*(\d{6,12})/i.exec(body)?.[1] ?? /\(#(\d{6,12})\)/.exec(body)?.[1] ?? null;
  const url = /(https:\/\/mail(?:-settings)?\.google\.com\/mail\/[^\s"'<>]+)/.exec(body)?.[1] ?? null;
  return { code, url };
}
