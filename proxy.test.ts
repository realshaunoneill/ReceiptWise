import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isProtectedPath } from './proxy';

describe('isProtectedPath', () => {
  it('covers every route in app/(protected)', () => {
    // A new signed-in page has to be added to PROTECTED_PREFIXES, or signed-out visitors reach it.
    const routes = readdirSync(new URL('./app/(protected)', import.meta.url), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `/${entry.name}`);
    expect(routes.length).toBeGreaterThan(5);
    for (const route of routes) expect(isProtectedPath(route), route).toBe(true);
  });

  it('protects nested app paths and leaves the rest public', () => {
    expect(isProtectedPath('/settings')).toBe(true);
    expect(isProtectedPath('/payment/successful')).toBe(true);
    expect(isProtectedPath('/')).toBe(false);
    expect(isProtectedPath('/sign-in')).toBe(false);
    expect(isProtectedPath('/invite/abc')).toBe(false);
    expect(isProtectedPath('/privacy')).toBe(false);
    expect(isProtectedPath('/this-does-not-exist')).toBe(false);
    expect(isProtectedPath('/plans')).toBe(false);
  });
});
