import { NextResponse } from 'next/server';
import { appleAppSiteAssociation } from '@/lib/app-links';

// iOS universal links (lib/app-links.ts). Fetched by Apple's CDN, so served as plain JSON.
export function GET() {
  const teamId = process.env.APPLE_TEAM_ID;
  if (!teamId) return new NextResponse(null, { status: 404 });
  return NextResponse.json(appleAppSiteAssociation(teamId), { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
