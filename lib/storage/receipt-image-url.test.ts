import { beforeAll, describe, expect, it } from 'vitest';
import {
  isValidReceiptImageSignature,
  longLivedReceiptImageUrl,
  privateImagePathname,
  receiptImageForClient,
  receiptImageForStorage,
  signedReceiptImageUrl,
} from './receipt-image-url';

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET = 'test-secret-for-receipt-images';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.example';
});

const pathname = 'production/receipts/7b1c/web-Tesco-abc123.jpg';
const now = Date.parse('2026-11-10T10:00:00Z');

describe('signed receipt image links', () => {
  it('signs a private image for clients, and turns the link back into the stored value', () => {
    const link = receiptImageForClient(`private:${pathname}`);
    expect(link).toMatch(/^https:\/\/app\.example\/receipt-images\/production\/receipts\/7b1c\/web-Tesco-abc123\.jpg\?e=\d+&s=/);
    expect(receiptImageForStorage(link)).toBe(`private:${pathname}`);
    expect(privateImagePathname(link)).toBe(pathname);
  });

  it('leaves older public images alone both ways', () => {
    const publicUrl = 'https://abc.public.blob.vercel-storage.com/prod/receipts/x/y.jpg';
    expect(receiptImageForClient(publicUrl)).toBe(publicUrl);
    expect(receiptImageForStorage(publicUrl)).toBe(publicUrl);
    expect(privateImagePathname(publicUrl)).toBeNull();
  });

  it('is the same link within a 6-hour window, good for 6 to 12 hours', () => {
    const a = signedReceiptImageUrl(pathname, { now })!;
    const b = signedReceiptImageUrl(pathname, { now: now + 60 * 60 * 1000 })!;
    expect(a).toBe(b);
    const expires = Number(new URL(a).searchParams.get('e')) * 1000;
    expect(expires - now).toBeGreaterThanOrEqual(6 * 60 * 60 * 1000);
    expect(expires - now).toBeLessThanOrEqual(12 * 60 * 60 * 1000);
  });

  it('refuses a forged or altered link, so it is never stored as private', () => {
    const link = new URL(signedReceiptImageUrl(pathname, { now })!);
    const e = Number(link.searchParams.get('e'));
    const s = link.searchParams.get('s')!;
    expect(isValidReceiptImageSignature(pathname, e, s)).toBe(true);
    expect(isValidReceiptImageSignature('production/receipts/other/x.jpg', e, s)).toBe(false);
    expect(isValidReceiptImageSignature(pathname, e + 1, s)).toBe(false);
    const forged = `https://app.example/receipt-images/${pathname}?e=${e}&s=AAAA`;
    expect(receiptImageForStorage(forged)).toBe(forged);
  });

  it('gives exports a link that lasts 30 days', () => {
    const link = longLivedReceiptImageUrl(`private:${pathname}`);
    const expires = Number(new URL(link).searchParams.get('e')) * 1000;
    expect(expires - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
  });
});
