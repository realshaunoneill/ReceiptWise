import { and, inArray, notInArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { receipts } from '@/lib/db/schema';

/**
 * The receipts Blob store's token, passed explicitly on every receipts Blob call.
 *
 * @vercel/blob >= 2.3 prefers OIDC plus BLOB_STORE_ID over BLOB_READ_WRITE_TOKEN when no token is
 * passed, and this project has OIDC on. Connecting any store to the project the usual way sets
 * BLOB_STORE_ID, which would silently send receipts to that store instead. Passing the token
 * keeps receipts in their own store whatever else is connected.
 */
export function receiptsBlobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN || undefined;
}

const ENV_PATH_PREFIX = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';

/** Where this user's receipt images go: every upload path, web or app, starts with it. */
export function receiptImagePrefix(userId: string): string {
  return `${ENV_PATH_PREFIX}/receipts/${userId}/`;
}

/**
 * The receipts store's public host, from its token (`vercel_blob_rw_<storeId>_<secret>`; the
 * store's URLs are `<storeid>.public.blob.vercel-storage.com`). Null if the token isn't that shape,
 * and then only the domain is checked.
 */
function receiptsStoreHost(): string | null {
  const parts = (receiptsBlobToken() ?? '').split('_');
  return parts.length >= 5 && parts[3] ? `${parts[3].toLowerCase()}.public.blob.vercel-storage.com` : null;
}

/**
 * An image this user uploaded to this app's receipts store. Anything else would be fetched for
 * reading (a blind SSRF), shown to the household, and later handed to del(). The per-user prefix
 * matters as much as the host: without it, a household member who had seen another's image URL
 * could file it as their own receipt, delete it, and the purge would then delete the owner's image.
 */
export function isOwnReceiptImageUrl(raw: unknown, userId: string): raw is string {
  if (typeof raw !== 'string') return false;
  try {
    const url = new URL(raw);
    const host = receiptsStoreHost();
    return (
      url.protocol === 'https:' &&
      (host ? url.hostname === host : url.hostname.endsWith('.public.blob.vercel-storage.com')) &&
      url.pathname.startsWith(`/${receiptImagePrefix(userId)}`)
    );
  } catch {
    return false;
  }
}

/**
 * Of the images belonging to these receipt rows, the ones no other row points at, so deleting
 * them can't take a picture another receipt still shows. Rows from before uploads were per user
 * could share an image.
 */
export async function imagesSafeToDelete(rows: Array<{ id: string; imageUrl: string | null }>): Promise<string[]> {
  const urls = [...new Set(rows.map((row) => row.imageUrl).filter((url): url is string => Boolean(url)))];
  if (urls.length === 0) return [];
  const stillUsed = new Set<string>();
  for (let i = 0; i < urls.length; i += 500) {
    const used = await db
      .select({ imageUrl: receipts.imageUrl })
      .from(receipts)
      .where(and(inArray(receipts.imageUrl, urls.slice(i, i + 500)), notInArray(receipts.id, rows.map((row) => row.id))));
    for (const row of used) if (row.imageUrl) stillUsed.add(row.imageUrl);
  }
  return urls.filter((url) => !stillUsed.has(url));
}
