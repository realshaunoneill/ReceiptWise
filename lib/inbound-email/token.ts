import { randomBytes } from 'crypto';

/**
 * Forwarding-address tokens: the whole local part of <token>@in.receiptwise.io. 16 random bytes
 * in lowercase base32 (RFC 4648 alphabet, no padding) is 26 characters, safe in an email address
 * and not guessable.
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
export const TOKEN_PATTERN = /^[a-z2-7]{26}$/;

export function generateInboundToken(): string {
  const bytes = randomBytes(16);
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

/**
 * The token in a recipient address on our inbound domain, or null. Plus-addressing is ignored
 * ("token+bills@" is the token), case is ignored, and anything on another domain is refused.
 */
export function tokenFromAddress(address: string | null | undefined, domain: string): string | null {
  if (!address) return null;
  const match = /<?([^<>\s@]+)@([^<>\s@]+)>?\s*$/.exec(address.trim());
  if (!match) return null;
  const [, local, host] = match;
  if (host.toLowerCase() !== domain.toLowerCase()) return null;
  const token = local.split('+')[0].toLowerCase();
  return TOKEN_PATTERN.test(token) ? token : null;
}

export function inboundDomain(): string {
  return process.env.INBOUND_EMAIL_DOMAIN || 'in.receiptwise.io';
}

export function addressFor(token: string): string {
  return `${token}@${inboundDomain()}`;
}
