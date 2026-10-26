import { Directory, File, Paths } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { toApiError } from './api/errors';
import { authHeaders } from './auth/auth';
import { SITE_URL } from './config';

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'text/csv': 'csv',
  'application/json': 'json',
};
const UTIS: Record<string, string> = { 'application/pdf': 'com.adobe.pdf', 'text/csv': 'public.comma-separated-values-text', 'application/json': 'public.json' };

/**
 * Open a file only the signed-in person may see (a bill, an export): fetched with the session, then
 * handed to the system's share sheet, which previews it and offers Save to Files, Mail and the
 * rest. The in-app browser can't be used: it doesn't have the app's session. The copy is deleted
 * once the sheet closes. The type comes from the response, so the name gets the right extension.
 */
export async function openPrivateFile(path: string, name: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.open(`${SITE_URL}${path}`, '_blank', 'noopener');
    return;
  }
  const res = await fetch(`${SITE_URL}${path}`, { headers: await authHeaders() });
  if (!res.ok) throw toApiError(res.status, await res.json().catch(() => null), res.headers.get('retry-after'));
  const mimeType = (res.headers.get('content-type') ?? '').split(';')[0].trim();
  const extension = EXTENSIONS[mimeType];
  const base = name.replace(/[^\w.\- ]+/g, '_').replace(/\.(pdf|jpe?g|png|webp|csv|json)$/i, '').slice(-80) || 'file';

  // A folder of its own, so two files with the same name never meet.
  const folder = new Directory(Paths.cache, 'open', Crypto.randomUUID());
  folder.create({ intermediates: true, idempotent: true });
  const file = new File(folder, extension ? `${base}.${extension}` : base);
  try {
    file.write(new Uint8Array(await res.arrayBuffer()));
    await Sharing.shareAsync(file.uri, { mimeType: mimeType || undefined, UTI: UTIS[mimeType], dialogTitle: name });
  } finally {
    if (file.exists) file.delete();
    if (folder.exists) folder.delete();
  }
}
