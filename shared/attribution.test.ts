import { describe, expect, it } from 'vitest';
import { attributionQuery, cleanAttribution, visitAttribution } from './attribution';

describe('cleanAttribution', () => {
  it('keeps a plain source, lowercased and without www.', () => {
    expect(cleanAttribution('ChatGPT.com')).toBe('chatgpt.com');
    expect(cleanAttribution('www.Google.ie')).toBe('google.ie');
    expect(cleanAttribution('jan_tax-back.2027')).toBe('jan_tax-back.2027');
  });

  it('refuses anything else', () => {
    expect(cleanAttribution('')).toBeNull();
    expect(cleanAttribution(null)).toBeNull();
    expect(cleanAttribution('<script>')).toBeNull();
    expect(cleanAttribution('a b')).toBeNull();
    expect(cleanAttribution('x'.repeat(65))).toBeNull();
  });
});

describe('visitAttribution', () => {
  it('prefers the link\'s utm_source, and carries utm_campaign', () => {
    expect(visitAttribution('?utm_source=chatgpt.com&utm_campaign=Jan', 'https://www.google.com/', 'www.receiptwise.io'))
      .toEqual({ src: 'chatgpt.com', cmp: 'jan' });
  });

  it('falls back to the site the visitor came from, but not this one', () => {
    expect(visitAttribution('', 'https://www.reddit.com/r/irishpersonalfinance/', 'www.receiptwise.io')).toEqual({ src: 'reddit.com', cmp: null });
    expect(visitAttribution('', 'https://www.receiptwise.io/support', 'www.receiptwise.io')).toEqual({ src: null, cmp: null });
    expect(visitAttribution('', 'not a url', 'www.receiptwise.io')).toEqual({ src: null, cmp: null });
  });

  it('reads its own ?src and ?cmp, so it survives the hop from the landing page to sign-up', () => {
    expect(visitAttribution('?src=reddit.com&cmp=launch', '', 'www.receiptwise.io')).toEqual({ src: 'reddit.com', cmp: 'launch' });
  });
});

describe('attributionQuery', () => {
  it('is empty with nothing to carry', () => {
    expect(attributionQuery({ src: null, cmp: null })).toBe('');
    expect(attributionQuery({ src: 'chatgpt.com', cmp: null })).toBe('?src=chatgpt.com');
    expect(attributionQuery({ src: 'google.com', cmp: 'tax' })).toBe('?src=google.com&cmp=tax');
  });
});
