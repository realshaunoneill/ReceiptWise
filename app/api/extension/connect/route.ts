import { randomUUID } from 'crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, requireNoPendingDeletion, requireSubscription } from '@/lib/auth-helpers';
import { type CorrelationId, submitLogEvent } from '@/lib/logging';
import { isAllowedExtension, isExtensionId } from '@/lib/extension-connect';
import { ApiKeyLimitError, createApiKey } from '@/lib/services/api-key-service';

export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * POST /api/extension/connect { extensionId } — one-click connect for ReceiptWise Clipper.
 *
 * The extension opens /connect/extension; the signed-in page asks for a key here and passes it to
 * the extension with chrome.runtime.sendMessage (the extension's externally_connectable allows only
 * receiptwise.io to message it). Replaces copying a key out of Settings and pasting it in.
 */
export async function POST(req: NextRequest) {
  const correlationId = (req.headers.get('x-correlation-id') || randomUUID()) as CorrelationId;
  const auth = await getAuthenticatedUser(correlationId);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  const subscription = await requireSubscription(user);
  if (subscription) return subscription;
  const deletion = requireNoPendingDeletion(user);
  if (deletion) return deletion;

  const body = await req.json().catch(() => null) as { extensionId?: unknown } | null;
  const extensionId = typeof body?.extensionId === 'string' ? body.extensionId : '';
  if (!isExtensionId(extensionId)) {
    return NextResponse.json({ error: 'That link is missing the extension it is for. Open it from the extension.' }, { status: 400, headers: NO_STORE });
  }
  if (!isAllowedExtension(extensionId)) {
    submitLogEvent('api-key', 'Connect refused for an unknown extension', correlationId, { userId: user.id, extensionId }, true);
    return NextResponse.json({ error: "That isn't the ReceiptWise Clipper extension." }, { status: 403, headers: NO_STORE });
  }

  try {
    const day = new Date().toISOString().slice(0, 10);
    const { record, key } = await createApiKey(user.id, `ReceiptWise Clipper (connected ${day})`);
    submitLogEvent('api-key', 'Extension connected', correlationId, { userId: user.id, keyId: record.id });
    return NextResponse.json({ key, email: user.email, subscribed: user.subscribed }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ApiKeyLimitError) return NextResponse.json({ error: error.message }, { status: 400, headers: NO_STORE });
    submitLogEvent('api-key', `Error connecting extension: ${error instanceof Error ? error.message : 'Unknown error'}`, correlationId, {}, true);
    return NextResponse.json({ error: "Couldn't connect the extension. Try again." }, { status: 500, headers: NO_STORE });
  }
}
