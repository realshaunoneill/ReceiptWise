import { createHash, randomBytes } from 'crypto';
import { and, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiKeys, users, type ApiKey, type User } from '@/lib/db/schema';

/*
 * API-key authentication for the Chrome extension routes (/api/extension/*), which sit outside
 * Clerk's middleware.
 *
 * This existed three times with different rules: upload checked blocked + subscribed, process
 * checked neither, and none checked a pending account deletion — so a suspended or lapsed user
 * with an old key could keep running GPT-4o on their receipts. Keys were also stored and compared
 * in plaintext; now only a SHA-256 digest is stored, and the plaintext is shown once at creation.
 */

const KEY_PREFIX_LENGTH = 11; // "rw_" plus 8 hex characters

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * A new key, its digest (what goes in `api_keys.key`) and a short display prefix.
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `rw_${randomBytes(32).toString('hex')}`;
  return { key, hash: hashApiKey(key), prefix: key.slice(0, KEY_PREFIX_LENGTH) };
}

export type ApiKeyAuthResult =
  | { ok: true; user: User; keyRecord: ApiKey; apiKey: string }
  | { ok: false; error: string; status: number };

/**
 * Authenticate an extension request from its X-API-Key header.
 *
 * Rejects missing, unknown, revoked and expired keys, blocked accounts, accounts inside their
 * deletion window, and accounts without an active subscription (unless SKIP_SUBSCRIPTION_CHECK is
 * set, as elsewhere). Updates the key's lastUsedAt on success.
 */
export async function authenticateApiKey(request: NextRequest): Promise<ApiKeyAuthResult> {
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey) {
    return { ok: false, error: 'API key required', status: 401 };
  }

  const [keyRecord] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.key, hashApiKey(apiKey)), eq(apiKeys.isRevoked, false)))
    .limit(1);

  if (!keyRecord) {
    return { ok: false, error: 'Invalid API key', status: 401 };
  }

  if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
    return { ok: false, error: 'API key expired', status: 401 };
  }

  const [user] = await db.select().from(users).where(eq(users.id, keyRecord.userId)).limit(1);

  if (!user) {
    return { ok: false, error: 'Invalid API key', status: 401 };
  }

  if (user.isBlocked) {
    return { ok: false, error: 'Account suspended', status: 403 };
  }

  if (user.deletionScheduledAt) {
    return {
      ok: false,
      error: 'Your account is scheduled for deletion. Cancel the deletion in Settings to keep using ReceiptWise.',
      status: 403,
    };
  }

  const skipSubscriptionCheck = process.env.SKIP_SUBSCRIPTION_CHECK === 'true';
  if (!skipSubscriptionCheck && !user.subscribed) {
    return { ok: false, error: 'Active subscription required', status: 403 };
  }

  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, keyRecord.id));

  return { ok: true, user, keyRecord, apiKey };
}
