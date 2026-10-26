import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { billFromParts, CaptureError, sniffBillType } from './bill-capture';

// A 1×1 PNG and a minimal JPEG (1×1, baseline).
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
const JPEG = Uint8Array.from(Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
));
const PDF = new TextEncoder().encode('%PDF-1.7\n%…');

describe('bill capture', () => {
  it('decides the type from the bytes', () => {
    expect(sniffBillType(PDF)).toBe('application/pdf');
    expect(sniffBillType(PNG)).toBe('image/png');
    expect(sniffBillType(JPEG)).toBe('image/jpeg');
    expect(sniffBillType(new TextEncoder().encode('<html>'))).toBeNull();
  });

  it('keeps a single file as it is', async () => {
    await expect(billFromParts([PDF])).resolves.toEqual({ bytes: PDF, mimeType: 'application/pdf' });
  });

  it('combines the pages of a scan into one PDF, a page each', async () => {
    const { bytes, mimeType } = await billFromParts([PNG, PNG, PNG]);
    expect(mimeType).toBe('application/pdf');
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);
  });

  it('refuses anything else', async () => {
    await expect(billFromParts([])).rejects.toBeInstanceOf(CaptureError);
    await expect(billFromParts([new TextEncoder().encode('<html>')])).rejects.toThrow('Send a PDF');
    await expect(billFromParts([PDF, PNG])).rejects.toThrow('send a PDF on its own');
    await expect(billFromParts(Array.from({ length: 11 }, () => PNG))).rejects.toThrow('Up to 10');
  });
});
