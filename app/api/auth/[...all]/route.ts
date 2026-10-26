import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/lib/auth';
import { withExpoOrigin } from '@/lib/expo-origin';

export const runtime = 'nodejs';

// Better Auth's endpoints: sign-in, the Google callback, session and sign-out, for the website and
// the app. The app's expo-origin header becomes Origin here (lib/expo-origin.ts).
export async function GET(req: Request) {
  return toNextJsHandler(getAuth()).GET(await withExpoOrigin(req));
}

export async function POST(req: Request) {
  return toNextJsHandler(getAuth()).POST(await withExpoOrigin(req));
}
