import { Platform } from 'react-native';

/**
 * The system's document scanner (VisionKit on iOS, ML Kit on Android): it finds the page's edges,
 * flattens and crops it, and can take several pages in one go. The scanned images' file uris, []
 * if it was cancelled, or null when there's no scanner (the web preview, an Android phone without
 * Play services, or a build from before it was added), so the camera is used instead.
 */
export async function scanDocuments(maxPages?: number): Promise<string[] | null> {
  if (Platform.OS === 'web') return null;
  try {
    // Required here, not imported: the module doesn't exist on the web, and an old build lacks it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: DocumentScanner } = require('react-native-document-scanner-plugin') as typeof import('react-native-document-scanner-plugin');
    const result = await DocumentScanner.scanDocument({ croppedImageQuality: 90, maxNumDocuments: maxPages });
    if (result.status === 'cancel') return [];
    return result.scannedImages ?? [];
  } catch {
    return null;
  }
}
