import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { authHeaders } from './auth/auth';
import { SITE_URL } from './config';

/**
 * Open a file only the signed-in person may see (a bill, an export): fetched with the session, then
 * handed to the system's share sheet, which previews it and offers Save to Files, Mail and the
 * rest. The in-app browser can't be used: it doesn't have the app's session. The copy is deleted
 * once the sheet closes.
 */
export async function openPrivateFile(path: string, name: string, mimeType: string): Promise<void> {
  if (Platform.OS === 'web') {
    window.open(`${SITE_URL}${path}`, '_blank', 'noopener');
    return;
  }
  const safeName = name.replace(/[^\w.\- ]+/g, '_').slice(-80) || 'file';
  const destination = new File(Paths.cache, safeName);
  if (destination.exists) destination.delete();
  const file = await File.downloadFileAsync(`${SITE_URL}${path}`, destination, { headers: await authHeaders() });
  try {
    await Sharing.shareAsync(file.uri, {
      mimeType,
      UTI: mimeType === 'application/pdf' ? 'com.adobe.pdf' : mimeType === 'text/csv' ? 'public.comma-separated-values-text' : undefined,
      dialogTitle: name,
    });
  } finally {
    if (file.exists) file.delete();
  }
}
