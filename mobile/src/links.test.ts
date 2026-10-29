import { describe, expect, it } from 'vitest';
import { routeForFile, routeForLink } from './links';

const TOKEN = 'a'.repeat(64);
const ID = '7836914d-84f8-4489-814a-2e09c8c4190f';

describe('links into the app', () => {
  it('opens an invitation link from the website or the app scheme', () => {
    expect(routeForLink(`https://www.receiptwise.io/invite/${TOKEN}`)).toBe(`/invite/${TOKEN}`);
    expect(routeForLink(`receiptwise:///invite/${TOKEN}`)).toBe(`/invite/${TOKEN}`);
    expect(routeForLink(`receiptwise://invite/${TOKEN}`)).toBe(`/invite/${TOKEN}`);
    // The development build's scheme maps the same way.
    expect(routeForLink(`receiptwise-dev:///invite/${TOKEN}`)).toBe(`/invite/${TOKEN}`);
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

  it("opens what a notification is about (lib/push/messages.ts's urls are bare paths)", () => {
    expect(routeForLink('/subscriptions?selected=24387178-f242-46c4-a045-ed043c499157')).toBe('/bills/24387178-f242-46c4-a045-ed043c499157');
    expect(routeForLink('/subscriptions?selected=nonsense')).toBe('/bills');
    expect(routeForLink('/receipts?selected=24387178-f242-46c4-a045-ed043c499157')).toBe('/receipts/24387178-f242-46c4-a045-ed043c499157');
    expect(routeForLink('/sharing')).toBe('/settings/households');
    expect(routeForLink('/settings')).toBe('/settings');
    expect(routeForLink('/plan')).toBe('/plan');
  });

  it('leaves everything else alone', () => {
    expect(routeForLink('https://www.receiptwise.io/invite/short')).toBeNull();
    expect(routeForLink('https://www.receiptwise.io/upgrade')).toBeNull();
    expect(routeForLink('https://evil.example/plan')).toBeNull();
    expect(routeForLink('receiptwise:///?cookie=abc')).toBeNull();
    expect(routeForLink('mailto:support@receiptwise.io')).toBeNull();
  });
});

describe('files opened in the app', () => {
  it('sends a file from another app to capture', () => {
    expect(routeForFile('file:///private/var/mobile/Containers/Data/Application/X/Documents/Inbox/bill.pdf'))
      .toBe('/capture?file=file%3A%2F%2F%2Fprivate%2Fvar%2Fmobile%2FContainers%2FData%2FApplication%2FX%2FDocuments%2FInbox%2Fbill.pdf');
    expect(routeForFile('content://com.android.providers.downloads.documents/document/42')).toMatch(/^\/capture\?file=content/);
  });

  it('leaves links alone', () => {
    expect(routeForFile('https://www.receiptwise.io/plan')).toBeNull();
    expect(routeForFile('receiptwise:///plan')).toBeNull();
  });
});
