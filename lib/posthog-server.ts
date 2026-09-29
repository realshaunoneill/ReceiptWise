import { PostHog } from 'posthog-node';
import { cookies } from 'next/headers';

let posthogClient: PostHog | null = null;

// Same name as CONSENT_COOKIE in lib/analytics/consent.ts (not imported: that module pulls in
// posthog-js, which has no place in a server bundle).
const CONSENT_COOKIE = 'rw-analytics-consent';

export function getPostHogClient(): PostHog | null {
  // Only initialize PostHog if the key is available (production only)
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

/**
 * The PostHog client, but only when the requesting visitor accepted analytics in the consent
 * banner. Server-side capture is still analytics, so it needs the same opt-in as the browser SDK.
 * Use this, not getPostHogClient, inside request handlers.
 */
export async function getConsentedPostHogClient(): Promise<PostHog | null> {
  const choice = (await cookies()).get(CONSENT_COOKIE)?.value;
  return choice === 'granted' ? getPostHogClient() : null;
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}
