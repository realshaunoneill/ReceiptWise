import { describe, expect, it } from 'vitest';
import { DEMO_WRITE_REFUSED, demoAnswer, demoKey } from './fetch-shim';

const at = (path: string) => new URL(path, 'https://www.receiptwise.io');
const responses = {
  '/api/plan?offset=0': { label: 'this month' },
  '/api/plan?offset=1': { label: 'next month' },
  '/api/receipts?limit=12&page=1&sortBy=date&sortOrder=desc': { receipts: ['tesco'] },
  '/api/users/me': { email: 'aoife@example.com' },
};

describe('demoKey', () => {
  it('orders the parameters and drops ?today', () => {
    expect(demoKey(at('/api/plan?today=2026-11-02&offset=0'))).toBe('/api/plan?offset=0');
    expect(demoKey(at('/api/receipts?sortOrder=desc&page=1&limit=12&sortBy=date'))).toBe('/api/receipts?limit=12&page=1&sortBy=date&sortOrder=desc');
  });
});

describe('demoAnswer', () => {
  it('answers a recorded request', () => {
    expect(demoAnswer(responses, at('/api/plan?offset=1&today=2026-12-01'), 'GET')).toEqual({ status: 200, body: { label: 'next month' } });
  });

  it('answers another page or filter with the recorded list, but never another month of the plan', () => {
    expect(demoAnswer(responses, at('/api/receipts?page=2&limit=12'), 'GET').body).toEqual({ receipts: ['tesco'] });
    expect(demoAnswer(responses, at('/api/plan?offset=5'), 'GET').status).toBe(404);
  });

  it('refuses every write', () => {
    expect(demoAnswer(responses, at('/api/users/me'), 'PATCH')).toEqual({ status: 403, body: { error: DEMO_WRITE_REFUSED } });
    expect(demoAnswer(responses, at('/api/plan/entries'), 'POST').status).toBe(403);
  });
});
