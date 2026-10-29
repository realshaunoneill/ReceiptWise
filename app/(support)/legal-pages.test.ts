import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The privacy policy, the terms and the pages beside them are high level on purpose (Shaun,
// 2026-10-29): kinds of data and kinds of company, never the suppliers' names, their regions or how
// the service is built. This reads each page's source with its comments removed, so a name in a
// code comment is fine but one in the text fails.
const PAGES = ['privacy', 'terms', 'refund', 'delete-account'];

const SUPPLIERS = [
  'Stripe', 'Vercel', 'Neon', 'Postgres', 'PostHog', 'Rapid7', 'InsightOps', 'Migadu', 'Cloudflare',
  'Expo', 'OpenAI', 'Gemini', 'RevenueCat', 'Firebase', 'Sentry',
];
const INTERNALS = [/eu-west-\d/i, /\bAI Gateway\b/i, /\bBlob\b/, /\bOCR\b/, /rate-limit/i, /\bAPI key/i, /secure storage/i, /push token/i];

function pageText(name: string): string {
  const source = readFileSync(fileURLToPath(new URL(`./${name}/page.tsx`, import.meta.url)), 'utf8');
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

describe('legal pages', () => {
  for (const name of PAGES) {
    it(`/${name} names no supplier and says nothing about how the service is built`, () => {
      const text = pageText(name);
      for (const supplier of SUPPLIERS) expect(text, supplier).not.toMatch(new RegExp(`\\b${supplier}\\b`, 'i'));
      for (const pattern of INTERNALS) expect(text, String(pattern)).not.toMatch(pattern);
    });
  }

  it('still gives the privacy policy what the GDPR asks for', () => {
    const text = pageText('privacy');
    for (const part of ['Who we are', 'What we collect', 'legal basis', 'Who else handles it', 'transfers', 'How long we keep it', 'Your rights', 'Data Protection Commission']) {
      expect(text, part).toContain(part);
    }
    // The consent banner links here.
    expect(text).toContain('id="cookies"');
  });
});
