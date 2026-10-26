import { describe, expect, it } from 'vitest';
import { toApiError } from './errors';

describe('toApiError', () => {
  it("reads the server's refusals as what the app should do", () => {
    expect(toApiError(401, { error: 'Unauthorized' }).kind).toBe('signed-out');
    expect(toApiError(403, { error: 'Active subscription required' }).kind).toBe('premium-required');
    expect(toApiError(403, { error: 'Your account is scheduled for deletion. Cancel…', deletionScheduledAt: '2026-10-27T10:00:00Z' }).kind).toBe('deletion-pending');
    expect(toApiError(403, { error: 'Your account has been suspended. Please contact support.' }).kind).toBe('suspended');
    expect(toApiError(403, { error: 'Only the owner can do that' }).kind).toBe('forbidden');
    expect(toApiError(404, {}).kind).toBe('not-found');
    expect(toApiError(400, { error: "kind must be 'receipt' or 'auto'" }).message).toBe("kind must be 'receipt' or 'auto'");
    expect(toApiError(500, { error: 'stack trace' }).message).not.toContain('stack');
  });

  it('keeps how long to wait after a rate limit', () => {
    const error = toApiError(429, { error: 'Upload limit reached' }, '120');
    expect(error.kind).toBe('rate-limited');
    expect(error.retryAfterSeconds).toBe(120);
    expect(toApiError(429, {}, 'soon').retryAfterSeconds).toBeNull();
  });

  it('copes with a body that is not JSON', () => {
    expect(toApiError(502, null).kind).toBe('server');
    expect(toApiError(403, 'nope').kind).toBe('forbidden');
  });

  it("reads the message from older routes' nested errors", () => {
    expect(toApiError(403, { error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Only household owners can update household details' } }).message)
      .toBe('Only household owners can update household details');
  });
});
