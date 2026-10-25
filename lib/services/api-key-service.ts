import { and, eq } from 'drizzle-orm';
import { generateApiKey } from '@/lib/api-key-auth';
import { db } from '@/lib/db';
import { apiKeys, type ApiKey } from '@/lib/db/schema';

/** Keys an account can have at once; revoked ones don't count. */
export const MAX_ACTIVE_KEYS = 10;

export class ApiKeyLimitError extends Error {
  constructor() {
    super(`You can have up to ${MAX_ACTIVE_KEYS} active keys. Revoke one you no longer use in Settings → Integrations first.`);
    this.name = 'ApiKeyLimitError';
  }
}

/**
 * A new API key for an account. Only its SHA-256 digest and a display prefix are stored; the
 * plaintext is returned once, here, and can't be recovered. Used by Settings (copy it into the
 * extension) and by the extension's one-click connect (/api/extension/connect).
 */
export async function createApiKey(userId: string, name: string): Promise<{ record: ApiKey; key: string }> {
  const active = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isRevoked, false)));
  if (active.length >= MAX_ACTIVE_KEYS) throw new ApiKeyLimitError();

  const { key, hash, prefix } = generateApiKey();
  const [record] = await db
    .insert(apiKeys)
    .values({ userId, key: hash, keyPrefix: prefix, name: name.trim().slice(0, 60) || 'Chrome Extension' })
    .returning();
  return { record, key };
}
