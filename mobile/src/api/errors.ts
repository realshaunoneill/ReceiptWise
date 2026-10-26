/**
 * What went wrong with a request, in the terms a screen acts on. The server answers errors as
 * `{ error: string, ... }` (lib/auth-helpers.ts), so the kind is read from the status and the body.
 */
export type ApiErrorKind =
  | 'signed-out' // 401: the session is gone; sign in again
  | 'premium-required' // 403 "Active subscription required"
  | 'deletion-pending' // 403 with deletionScheduledAt: cancel the deletion first
  | 'suspended' // 403: the account is blocked
  | 'forbidden'
  | 'not-found'
  | 'rate-limited' // 429, with Retry-After
  | 'invalid'
  | 'server'
  | 'offline';

export class ApiError extends Error {
  constructor(message: string, readonly kind: ApiErrorKind, readonly status: number, readonly retryAfterSeconds: number | null = null) {
    super(message);
    this.name = 'ApiError';
  }
}

export function toApiError(status: number, body: unknown, retryAfter: string | null = null): ApiError {
  const record = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const message = typeof record.error === 'string' ? record.error : typeof record.message === 'string' ? record.message : '';
  const fallback = (text: string) => message || text;

  if (status === 401) return new ApiError(fallback('Sign in again to carry on.'), 'signed-out', status);
  if (status === 403) {
    if (/subscription required/i.test(message)) return new ApiError('That needs ReceiptWise Premium.', 'premium-required', status);
    if (record.deletionScheduledAt) return new ApiError(message, 'deletion-pending', status);
    if (/suspended/i.test(message) || 'blockedReason' in record) return new ApiError(message, 'suspended', status);
    return new ApiError(fallback("You can't do that here."), 'forbidden', status);
  }
  if (status === 404) return new ApiError(fallback("That isn't there any more."), 'not-found', status);
  if (status === 429) {
    const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : null;
    return new ApiError(fallback('Too many at once. Try again in a little while.'), 'rate-limited', status, seconds);
  }
  if (status >= 400 && status < 500) return new ApiError(fallback("That wasn't accepted."), 'invalid', status);
  return new ApiError("ReceiptWise didn't answer properly. Try again in a moment.", 'server', status);
}

/** A request that never reached the server. */
export function offlineError(): ApiError {
  return new ApiError("Couldn't reach ReceiptWise. Check your connection.", 'offline', 0);
}
