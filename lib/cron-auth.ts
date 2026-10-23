import { timingSafeEqual } from 'crypto';
import { type NextRequest } from 'next/server';

/**
 * Constant-time comparison of the cron bearer token. Fails closed when CRON_SECRET is
 * unset so a misconfigured deploy can't expose an unauthenticated destructive endpoint.
 */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const provided = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
