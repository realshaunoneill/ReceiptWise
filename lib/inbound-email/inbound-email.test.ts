import { describe, expect, it } from 'vitest';
import { type Email } from 'postal-mime';
import { forwardingConfirmation, htmlToText, selectParts } from './parts';
import { generateInboundToken, TOKEN_PATTERN, tokenFromAddress } from './token';

const DOMAIN = 'in.receiptwise.io';

describe('tokens', () => {
  it('generates 26-character base32 tokens, all different', () => {
    const tokens = new Set(Array.from({ length: 50 }, generateInboundToken));
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(token).toMatch(TOKEN_PATTERN);
  });

  it('reads the token from an address on our domain only', () => {
    const token = generateInboundToken();
    expect(tokenFromAddress(`${token}@${DOMAIN}`, DOMAIN)).toBe(token);
    expect(tokenFromAddress(`${token.toUpperCase()}+bills@IN.RECEIPTWISE.IO`, DOMAIN)).toBe(token);
    expect(tokenFromAddress(`Megan <${token}@${DOMAIN}>`, DOMAIN)).toBe(token);
    expect(tokenFromAddress(`${token}@receiptwise.io`, DOMAIN)).toBeNull();
    expect(tokenFromAddress(`short@${DOMAIN}`, DOMAIN)).toBeNull();
    expect(tokenFromAddress(null, DOMAIN)).toBeNull();
  });
});

function email(partial: Partial<Email>): Email {
  return { headers: [], headerLines: [], attachments: [], ...partial } as Email;
}

const pdf = (size: number) => new Uint8Array(size).fill(1);

describe('selectParts', () => {
  it('takes PDF and image attachments and skips small inline logos', () => {
    const { parts, text } = selectParts(email({
      text: 'See attached',
      attachments: [
        { filename: 'bill.pdf', mimeType: 'application/pdf', disposition: 'attachment', content: pdf(50_000) },
        { filename: 'logo.png', mimeType: 'image/png', disposition: 'inline', contentId: '<logo>', content: pdf(4_000) },
        { filename: 'photo.jpg', mimeType: 'image/jpeg', disposition: 'attachment', content: pdf(900_000) },
        { filename: 'invite.ics', mimeType: 'text/calendar', disposition: 'attachment', content: pdf(500) },
      ],
    }));
    expect(parts.map((p) => [p.index, p.fileName, p.mimeType])).toEqual([[0, 'bill.pdf', 'application/pdf'], [1, 'photo.jpg', 'image/jpeg']]);
    expect(text).toBeNull();
  });

  it('falls back to the text, or the HTML as text, when there are no attachments', () => {
    expect(selectParts(email({ text: 'Your bill of €61.50 is due on 3 Nov' })).text).toBe('Your bill of €61.50 is due on 3 Nov');
    expect(selectParts(email({ html: '<style>x{}</style><p>Amount due:&nbsp;<b>&euro;61.50</b></p><p>Due 3 Nov</p>' })).text)
      .toBe('Amount due: €61.50\nDue 3 Nov');
    expect(selectParts(email({})).text).toBeNull();
  });

  it('caps the number of parts', () => {
    const attachments = Array.from({ length: 8 }, (_, i) => ({ filename: `b${i}.pdf`, mimeType: 'application/pdf', disposition: 'attachment' as const, content: pdf(1000) }));
    expect(selectParts(email({ attachments })).parts).toHaveLength(5);
  });
});

describe('forwardingConfirmation', () => {
  it("picks Gmail's code and link out of its confirmation email", () => {
    const confirmation = forwardingConfirmation(email({
      from: { address: 'forwarding-noreply@google.com', name: 'Gmail Team' },
      subject: '(#123456789) Gmail Forwarding Confirmation - Receive Mail from megan@example.com',
      text: 'Confirmation code: 123456789\n\nTo allow this, click: https://mail-settings.google.com/mail/vf-%5BANGjdJ%5D-abc123\n',
    }));
    expect(confirmation).toEqual({ code: '123456789', url: 'https://mail-settings.google.com/mail/vf-%5BANGjdJ%5D-abc123' });
  });

  it('ignores everything else', () => {
    expect(forwardingConfirmation(email({ from: { address: 'billing@electricireland.ie', name: '' }, subject: 'Your bill' }))).toBeNull();
  });
});

describe('htmlToText', () => {
  it('keeps the words and line breaks', () => {
    expect(htmlToText('<div>Hello</div><div>World &amp; co</div>')).toBe('Hello\nWorld & co');
  });
});
