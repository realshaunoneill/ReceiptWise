// Read a bill file with the bill extractor and print what it found, storing nothing.
// For trying the prompt against real bills: npx dotenv -e .env.local -- npx tsx scripts/read-bill.ts <file.pdf|jpg|png|webp>
// The output is the bill's contents: don't paste it anywhere shared.

import { readFileSync } from 'fs';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { analyzeBillDocument, isEncryptedPdf } from '../lib/bill-extraction';
import { type CorrelationId } from '../lib/logging';

const MIME: Record<string, string> = { '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

async function main() {
  const file = process.argv[2];
  const mimeType = file ? MIME[extname(file).toLowerCase()] : undefined;
  if (!file || !mimeType) {
    console.error('Usage: npx tsx scripts/read-bill.ts <file.pdf|jpg|png|webp>');
    process.exit(1);
  }
  const bytes = readFileSync(file);
  if (mimeType === 'application/pdf' && isEncryptedPdf(bytes)) {
    console.error('read-bill: the PDF is password-protected');
    process.exit(1);
  }
  const { data, usage } = await analyzeBillDocument(
    { kind: 'file', bytes, mimeType, fileName: file },
    { userId: 'local', documentId: 'local', correlationId: randomUUID() as CorrelationId },
  );
  console.log(JSON.stringify({ data, usage }, null, 2));
}

main().catch((error) => {
  console.error('read-bill failed', error);
  process.exit(1);
});
