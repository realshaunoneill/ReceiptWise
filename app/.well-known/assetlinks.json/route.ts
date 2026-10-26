import { NextResponse } from 'next/server';
import { androidAssetLinks, parseFingerprints } from '@/lib/app-links';

// Android App Links (lib/app-links.ts).
export function GET() {
  const fingerprints = parseFingerprints(process.env.ANDROID_CERT_SHA256);
  if (fingerprints.length === 0) return new NextResponse(null, { status: 404 });
  return NextResponse.json(androidAssetLinks(fingerprints), { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
