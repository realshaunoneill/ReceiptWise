import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiKey } from '@/lib/api-key-auth';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await authenticateApiKey(req);
    if (!auth.ok) {
      return NextResponse.json(
        { valid: false, error: auth.error },
        { status: auth.status, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      {
        valid: true,
        user: {
          email: auth.user.email,
          subscribed: auth.user.subscribed,
        },
      },
      { headers: corsHeaders },
    );
  } catch {
    return NextResponse.json(
      { valid: false, error: 'Verification failed' },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
