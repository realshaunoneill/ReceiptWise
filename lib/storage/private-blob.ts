import { mkdir, readFile, rm, stat, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { del, get, head, put } from '@vercel/blob';

/**
 * The private Blob store for bills (and forwarded emails). Bills carry names, addresses and
 * account numbers, so unlike receipt images they are never at a public URL: the store is created
 * private, and files are read back through an authenticated route.
 *
 * Its token is BILLS_BLOB_READ_WRITE_TOKEN (the store is connected to the project with the
 * BILLS_ prefix) and is passed explicitly on every call: with two stores, the SDK's implicit
 * BLOB_READ_WRITE_TOKEN is the receipts store's.
 *
 * For local development without that store, BILLS_BLOB_DEV_DIR (ignored in production) keeps the
 * files in a local folder instead. Browser uploads still need the real store; server-side writes
 * (forwarded email, moving a receipt) and every read work.
 */

export const BILL_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_BILL_BYTES = 15 * 1024 * 1024;

function devDir(): string | null {
  return process.env.NODE_ENV !== 'production' && process.env.BILLS_BLOB_DEV_DIR ? process.env.BILLS_BLOB_DEV_DIR : null;
}

function devPath(pathname: string): string {
  if (pathname.includes('..')) throw new Error('Invalid pathname');
  return join(devDir()!, pathname);
}

function token(): string {
  const value = process.env.BILLS_BLOB_READ_WRITE_TOKEN;
  if (!value) throw new Error('BILLS_BLOB_READ_WRITE_TOKEN is not set');
  return value;
}

export function isPrivateStoreConfigured(): boolean {
  return Boolean(process.env.BILLS_BLOB_READ_WRITE_TOKEN || devDir());
}

/** Every file of a user's lives under this prefix; routes check pathnames against it. */
export function billsPrefix(userId: string): string {
  const environment = process.env.VERCEL_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'development');
  return `${environment}/bills/${userId}/`;
}

export function isOwnBillPath(pathname: string, userId: string): boolean {
  return pathname.startsWith(billsPrefix(userId)) && !pathname.includes('..');
}

export async function putPrivate(pathname: string, body: Buffer, contentType: string) {
  if (devDir()) {
    await mkdir(dirname(devPath(pathname)), { recursive: true });
    await writeFile(devPath(pathname), body);
    return { pathname, contentType };
  }
  return put(pathname, body, {
    access: 'private',
    token: token(),
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function headPrivate(pathname: string): Promise<{ contentType: string; size: number }> {
  if (devDir()) {
    const info = await stat(devPath(pathname));
    return { contentType: pathname.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream', size: info.size };
  }
  return head(pathname, { token: token() });
}

/** The file's bytes, or null if it isn't there. */
export async function readPrivate(pathname: string): Promise<Buffer | null> {
  if (devDir()) return readFile(devPath(pathname)).catch(() => null);
  const result = await get(pathname, { access: 'private', token: token(), useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

/** A stream of the file for an authenticated download route, or null if it isn't there. */
export async function streamPrivate(pathname: string): Promise<{ statusCode: number; stream: ReadableStream<Uint8Array> } | null> {
  if (devDir()) {
    const bytes = await readFile(devPath(pathname)).catch(() => null);
    return bytes ? { statusCode: 200, stream: new Response(bytes).body! } : null;
  }
  const result = await get(pathname, { access: 'private', token: token() });
  return result && result.statusCode === 200 ? { statusCode: 200, stream: result.stream } : null;
}

export async function deletePrivate(pathnames: string[]): Promise<void> {
  if (pathnames.length === 0) return;
  if (devDir()) {
    for (const pathname of pathnames) await rm(devPath(pathname), { force: true });
    return;
  }
  await del(pathnames, { token: token() });
}

export function readWriteToken(): string {
  return token();
}
