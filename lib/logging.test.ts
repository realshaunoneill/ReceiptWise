import { describe, expect, it } from 'vitest';
import { redactValue } from './logging';

describe('redactValue', () => {
  it('strips email addresses, from keys and from text', () => {
    expect(redactValue({ userEmail: 'a@b.ie', note: 'from aoife@example.com' })).toEqual({ userEmail: '[email]', note: 'from [email]' });
  });

  it('leaves out receipt contents and image links, keeping ids and counts', () => {
    const url = 'https://abc123.public.blob.vercel-storage.com/prod/receipts/x-1.webp';
    expect(redactValue({
      userId: 'u1',
      itemCount: 3,
      imageUrl: url,
      extractedData: { merchant: 'Tesco', items: [{ name: 'Milk' }] },
      context: { businessNotes: 'client lunch', message: `Fetched ${url}` },
    })).toEqual({
      userId: 'u1',
      itemCount: 3,
      imageUrl: '[omitted]',
      extractedData: '[omitted]',
      context: { businessNotes: '[omitted]', message: 'Fetched [image-url]' },
    });
  });
});
