import { describe, expect, it } from 'vitest';
import { routeForLink } from './links';

const TOKEN = 'a'.repeat(64);
const ID = '7836914d-84f8-4489-814a-2e09c8c4190f';

describe('links into the app', () => {
  it('opens an invitation link from the website or the app scheme', () => {
    expect(routeForLink(`https://www.receiptwise.io/invite/${TOKEN}`)).toBe(`/invite/${TOKEN}`);
    expect(routeForLink(`receiptwise:///invite/${TOKEN}`)).toBe(`/invite/${TOKEN}`);
    expect(routeForLink(`receiptwise://invite/${TOKEN}`)).toBe(`/invite/${TOKEN}`);
    expect(routeForLink(`/invite/${TOKEN}`)).toBe(`/invite/${TOKEN}`);
  });

  it('opens a selected receipt, or the list', () => {
    expect(routeForLink(`https://www.receiptwise.io/receipts?selected=${ID}`)).toBe(`/receipts/${ID}`);
    expect(routeForLink('https://www.receiptwise.io/receipts?selected=not-an-id')).toBe('/receipts');
    expect(routeForLink('https://receiptwise.io/receipts/')).toBe('/receipts');
  });

  it("maps the website's pages to the app's tabs", () => {
    expect(routeForLink('https://www.receiptwise.io/plan')).toBe('/plan');
    expect(routeForLink('https://www.receiptwise.io/dashboard')).toBe('/');
    expect(routeForLink('https://www.receiptwise.io/subscriptions')).toBe('/bills');
  });

  it('leaves everything else alone', () => {
    expect(routeForLink('https://www.receiptwise.io/invite/short')).toBeNull();
    expect(routeForLink('https://www.receiptwise.io/upgrade')).toBeNull();
    expect(routeForLink('https://evil.example/plan')).toBeNull();
    expect(routeForLink('receiptwise:///?cookie=abc')).toBeNull();
    expect(routeForLink('mailto:support@receiptwise.io')).toBeNull();
  });
});
