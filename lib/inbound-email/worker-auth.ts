import { timingSafeEqual } from 'crypto';
import { type NextRequest } from 'next/server';

/**
 * The Cloudflare Email Worker authenticates with a shared bearer secret, INBOUND_WORKER_SECRET,
 * set in both the Worker and Vercel. Constant-time compare; fails closed when it is unset.
 */
export function isWorkerAuthorized(req: NextRequest): boolean {
  const secret = process.env.INBOUND_WORKER_SECRET;
  if (!secret) return false;
  const provided = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
