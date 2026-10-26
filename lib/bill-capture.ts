import { PDFDocument } from 'pdf-lib';

/**
 * Bills sent from the app (POST /api/bills/documents/capture): one PDF, one photo, or the pages
 * of a scan, which become one PDF so the reader sees the whole bill at once.
 *
 * The type is decided from the bytes, never from what the phone said: the stored mimeType is what
 * the reader and the file route trust.
 */

export const MAX_CAPTURE_BYTES = 4 * 1024 * 1024; // under Vercel's 4.5 MB request limit
export const MAX_CAPTURE_PAGES = 10;

export type CaptureType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

export function sniffBillType(bytes: Uint8Array): CaptureType | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (ascii(0, 5) === '%PDF-') return 'application/pdf';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export class CaptureError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/**
 * What to store for these files: a single file as it is, or several pages as one PDF, an A4-wide
 * page per image. Only JPEG and PNG pages can be combined (all the app sends); a PDF has to come
 * on its own.
 */
export async function billFromParts(parts: Uint8Array[]): Promise<{ bytes: Uint8Array; mimeType: CaptureType }> {
  if (parts.length === 0) throw new CaptureError('No file provided');
  if (parts.length > MAX_CAPTURE_PAGES) throw new CaptureError(`Up to ${MAX_CAPTURE_PAGES} pages at a time`);
  const types = parts.map(sniffBillType);
  if (types.some((type) => type === null)) throw new CaptureError('Send a PDF, or photos as JPEG or PNG');
  if (parts.length === 1) return { bytes: parts[0], mimeType: types[0]! };
  if (types.some((type) => type !== 'image/jpeg' && type !== 'image/png')) {
    throw new CaptureError('Pages can only be combined from JPEG or PNG photos; send a PDF on its own');
  }

  const pdf = await PDFDocument.create();
  for (const [index, part] of parts.entries()) {
    const image = types[index] === 'image/png' ? await pdf.embedPng(part) : await pdf.embedJpg(part);
    const width = 595; // A4 at 72 dpi; the height follows the photo
    const height = (image.height / image.width) * width;
    pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
  }
  const bytes = await pdf.save();
  if (bytes.byteLength > MAX_CAPTURE_BYTES) throw new CaptureError('Those pages are too large together. Send fewer at a time', 413);
  return { bytes, mimeType: 'application/pdf' };
}
