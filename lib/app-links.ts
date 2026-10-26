/**
 * The files that let the app open www.receiptwise.io links (universal links on iOS, App Links on
 * Android). Only the pages the app has an answer for are claimed: an invitation, receipts, the
 * plan, the dashboard and bills. Never /api: claiming the auth callback would hand web Google
 * sign-in to the app on any phone that has it.
 *
 * They need values that only exist once the developer accounts do: APPLE_TEAM_ID, and
 * ANDROID_CERT_SHA256 (the app signing certificate's SHA-256, comma-separated if more than one,
 * from `eas credentials` or the Play Console). Until then the routes answer 404, which the
 * platforms treat as "no app".
 */

export const APP_ID = 'io.receiptwise.app';

/** The paths the app opens; everything else stays in the browser. */
export const APP_LINK_PATHS = ['/invite/*', '/receipts', '/receipts/*', '/plan', '/plan/*', '/dashboard', '/subscriptions', '/subscriptions/*'];

export function appleAppSiteAssociation(teamId: string) {
  return {
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.${APP_ID}`],
          components: APP_LINK_PATHS.map((path) => ({ '/': path })),
        },
      ],
    },
  };
}

export function androidAssetLinks(fingerprints: string[]) {
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: APP_ID, sha256_cert_fingerprints: fingerprints },
    },
  ];
}

/** "AB:CD:…" fingerprints from a comma-separated env value; only well-formed ones. */
export function parseFingerprints(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter((value) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value));
}
