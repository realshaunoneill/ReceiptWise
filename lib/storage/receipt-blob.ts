import { randomBytes } from 'crypto';
import { and, inArray, notInArray } from 'drizzle-orm';
import { del } from '@vercel/blob';
import { db } from '@/lib/db';
import { receipts } from '@/lib/db/schema';
import { deletePrivate, putPrivate, readPrivate } from '@/lib/storage/private-blob';
import { PRIVATE_IMAGE_PREFIX, privateImagePathname } from '@/lib/storage/receipt-image-url';

/*
 * Receipt images. New ones go to the private store (the bills store, lib/storage/private-blob.ts)
 * under the person's own folder, and are shown through signed links (receipt-image-url.ts). Older
 * ones are still in the public receipts store until scripts/migrate-receipt-images.ts moves them,
 * so every read and delete here handles both kinds.
 */

/**
 * The public receipts store's token, passed explicitly on every call to it.
 *
 * @vercel/blob >= 2.3 prefers OIDC plus BLOB_STORE_ID over BLOB_READ_WRITE_TOKEN when no token is
 * passed, and this project has OIDC on. Connecting any store to the project the usual way sets
 * BLOB_STORE_ID, which would silently send calls to that store instead.
 */
export function receiptsBlobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN || undefined;
}

export const RECEIPT_IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** Every receipt image of a user's lives under this prefix in the private store. */
export function receiptImagePrefix(userId: string): string {
  const environment = process.env.VERCEL_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'development');
  return `${environment}/receipts/${userId}/`;
}

/**
 * A private-store pathname this user uploaded to. Without the per-user check, a household member
 * who had seen another's image could file it as their own receipt, delete it, and the purge would
 * then delete the owner's image.
 */
export function isOwnReceiptImagePath(pathname: unknown, userId: string): pathname is string {
  return typeof pathname === 'string' && pathname.startsWith(receiptImagePrefix(userId)) && !pathname.includes('..');
}

/** Stores an image the server received, and returns the value for receipts.image_url. */
export async function storeReceiptImage(userId: string, name: string, bytes: Buffer, contentType: string): Promise<string> {
  const extension = RECEIPT_IMAGE_TYPES[contentType] ?? 'jpg';
  const pathname = `${receiptImagePrefix(userId)}${name}-${randomBytes(12).toString('hex')}.${extension}`;
  await putPrivate(pathname, bytes, contentType);
  return `${PRIVATE_IMAGE_PREFIX}${pathname}`;
}

/** The image's bytes, from the private store or (an older image) its public URL. */
export async function readReceiptImage(imageUrl: string, timeoutMs = 15_000): Promise<{ bytes: Buffer; contentType: string } | null> {
  const pathname = privateImagePathname(imageUrl);
  if (pathname) {
    const bytes = await readPrivate(pathname);
    const extension = pathname.split('.').pop()?.toLowerCase() ?? '';
    const contentType = Object.entries(RECEIPT_IMAGE_TYPES).find(([, ext]) => ext === extension)?.[0] ?? 'image/jpeg';
    return bytes ? { bytes, contentType } : null;
  }
  // A data: URL (scripts/model-bakeoff.ts) needs no fetch at all.
  const inline = imageUrl.match(/^data:(image\/[a-z+.-]+);base64,(.*)$/i);
  if (inline) return { bytes: Buffer.from(inline[2], 'base64'), contentType: inline[1].toLowerCase() };
  // Only our public store: anything else would be a blind server-side fetch of any URL.
  if (!isPublicBlobUrl(imageUrl)) return null;
  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) return null;
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim(),
  };
}

export function isPublicBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.public.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

/** Deletes images of either kind; anything that's neither (a demo file, say) is left alone. */
export async function deleteReceiptImages(imageUrls: string[]): Promise<number> {
  const privatePaths = imageUrls.map(privateImagePathname).filter((path): path is string => Boolean(path));
  const publicUrls = imageUrls.filter((url) => !privateImagePathname(url) && isPublicBlobUrl(url));
  for (let i = 0; i < privatePaths.length; i += 1000) await deletePrivate(privatePaths.slice(i, i + 1000));
  for (let i = 0; i < publicUrls.length; i += 1000) await del(publicUrls.slice(i, i + 1000), { token: receiptsBlobToken() });
  return privatePaths.length + publicUrls.length;
}

/**
 * Of the images belonging to these receipt rows, the ones no other row points at, so deleting
 * them can't take a picture another receipt still shows. Rows from before uploads were per user
 * could share an image. Compared by where the image is, not by its link, which is signed afresh.
 */
export async function imagesSafeToDelete(rows: Array<{ id: string; imageUrl: string | null }>): Promise<string[]> {
  const where = (url: string) => privateImagePathname(url) ?? url;
  const urls = [...new Map(rows.filter((row) => row.imageUrl).map((row) => [where(row.imageUrl!), row.imageUrl!])).values()];
  if (urls.length === 0) return [];
  const stillUsed = new Set<string>();
  for (let i = 0; i < urls.length; i += 500) {
    const used = await db
      .select({ imageUrl: receipts.imageUrl })
      .from(receipts)
      .where(and(inArray(receipts.imageUrl, urls.slice(i, i + 500)), notInArray(receipts.id, rows.map((row) => row.id))));
    for (const row of used) if (row.imageUrl) stillUsed.add(where(row.imageUrl));
  }
  return urls.filter((url) => !stillUsed.has(where(url)));
}
