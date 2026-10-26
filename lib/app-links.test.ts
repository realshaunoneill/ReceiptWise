import { describe, expect, it } from 'vitest';
import { androidAssetLinks, APP_LINK_PATHS, appleAppSiteAssociation, parseFingerprints } from './app-links';

describe('app links', () => {
  it('never claims the API, so web sign-in stays in the browser', () => {
    expect(APP_LINK_PATHS.some((path) => path.startsWith('/api'))).toBe(false);
    expect(APP_LINK_PATHS).toContain('/invite/*');
  });

  it('names the app by team and bundle id for Apple, and by package and certificate for Android', () => {
    expect(appleAppSiteAssociation('ABCDE12345').applinks.details[0].appIDs).toEqual(['ABCDE12345.io.receiptwise.app']);
    const fingerprint = Array.from({ length: 32 }, () => 'AB').join(':');
    expect(androidAssetLinks([fingerprint])[0].target).toEqual({ namespace: 'android_app', package_name: 'io.receiptwise.app', sha256_cert_fingerprints: [fingerprint] });
  });

  it('keeps only well-formed certificate fingerprints', () => {
    const good = Array.from({ length: 32 }, () => 'a1').join(':');
    expect(parseFingerprints(` ${good} , nonsense,`)).toEqual([good.toUpperCase()]);
    expect(parseFingerprints(undefined)).toEqual([]);
  });
});
