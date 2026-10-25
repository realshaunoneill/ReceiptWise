import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, requireSubscription } from '@/lib/auth-helpers';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { ApiKeyLimitError, createApiKey } from '@/lib/services/api-key-service';

export const runtime = 'nodejs';


/*
 * Keys are stored as a SHA-256 digest (see lib/api-key-auth.ts), so the plaintext exists only in
 * the POST response and in the extension. The list shows the stored prefix instead.
 */
function displayKey(prefix: string | null): string {
  return prefix ? `${prefix}${'•'.repeat(12)}` : `rw_${'•'.repeat(12)}`;
}

// GET - List all API keys for the user (masked for security)
export async function GET(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // Check subscription
    const subCheck = await requireSubscription(user);
    if (subCheck) return subCheck;

    // Get all active API keys for the user
    const keys = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.userId, user.id),
          eq(apiKeys.isRevoked, false),
        ),
      )
      .orderBy(apiKeys.createdAt);

    // Return masked keys for security
    const maskedKeys = keys.map(k => ({
      id: k.id,
      name: k.name,
      maskedKey: displayKey(k.keyPrefix),
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
    }));

    return NextResponse.json({ keys: maskedKeys });
  } catch (error) {
    submitLogEvent('api-key', `Error listing API keys: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to list API keys' },
      { status: 500 },
    );
  }
}

// POST - Create a new API key
export async function POST(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // Check subscription
    const subCheck = await requireSubscription(user);
    if (subCheck) return subCheck;

    // Parse request body for optional key name
    const body = await req.json().catch(() => ({}));
    const keyName = typeof body.name === 'string' && body.name.trim()
      ? body.name.trim().slice(0, 60)
      : 'Chrome Extension';

    let created;
    let newKey: string;
    try {
      ({ record: created, key: newKey } = await createApiKey(user.id, keyName));
    } catch (error) {
      if (error instanceof ApiKeyLimitError) return NextResponse.json({ error: error.message }, { status: 400 });
      throw error;
    }

    submitLogEvent('api-key', 'Created new API key', correlationId, { userId: user.id, keyName });

    // Return full key only on creation (user needs to copy it)
    return NextResponse.json({
      id: created.id,
      key: newKey, // Plaintext shown only once; it is not recoverable afterwards
      name: created.name,
      createdAt: created.createdAt,
      lastUsedAt: created.lastUsedAt,
    });
  } catch (error) {
    submitLogEvent('api-key', `Error creating API key: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 },
    );
  }
}

// DELETE - Revoke specific API key by ID
export async function DELETE(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;

  try {
    const authResult = await getAuthenticatedUser(correlationId);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    // The key's id comes in the body. A missing or malformed body is a 400, not a 500.
    const body = await req.json().catch(() => null) as { keyId?: unknown } | null;
    const keyId = typeof body?.keyId === 'string' ? body.keyId : null;

    if (!keyId) {
      return NextResponse.json(
        { error: 'API key ID is required' },
        { status: 400 },
      );
    }

    // Revoke the specific key (verify it belongs to the user)
    const result = await db
      .update(apiKeys)
      .set({ isRevoked: true })
      .where(
        and(
          eq(apiKeys.id, keyId),
          eq(apiKeys.userId, user.id),
        ),
      )
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'API key not found or access denied' },
        { status: 404 },
      );
    }

    submitLogEvent('api-key', 'Revoked API key', correlationId, { userId: user.id, keyId });

    return NextResponse.json({ success: true });
  } catch (error) {
    submitLogEvent('api-key', `Error revoking API key: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 },
    );
  }
}
