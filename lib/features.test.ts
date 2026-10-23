import { afterEach, describe, expect, it, vi } from 'vitest';
import { featureFlagsFor, isFeatureEnabled } from './features';

const member = { email: 'someone@example.com', isAdmin: false };
const admin = { email: 'admin@example.com', isAdmin: true };

describe('isFeatureEnabled', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is on only for admins and the allowlist by default', () => {
    vi.stubEnv('FEATURE_BILLS', '');
    vi.stubEnv('FEATURE_BILLS_ALLOWLIST', ' Someone@Example.com , other@example.com');
    expect(isFeatureEnabled(admin, 'bills')).toBe(true);
    expect(isFeatureEnabled(member, 'bills')).toBe(true);
    expect(isFeatureEnabled({ email: 'stranger@example.com', isAdmin: false }, 'bills')).toBe(false);
  });

  it('is on for everyone with "all" and off for everyone with "off"', () => {
    vi.stubEnv('FEATURE_BILLS', 'all');
    expect(isFeatureEnabled(member, 'bills')).toBe(true);
    vi.stubEnv('FEATURE_BILLS', 'off');
    expect(isFeatureEnabled(admin, 'bills')).toBe(false);
  });

  it('builds the flags object for /api/users/me', () => {
    vi.stubEnv('FEATURE_BILLS', '');
    vi.stubEnv('FEATURE_BILLS_ALLOWLIST', '');
    expect(featureFlagsFor(member)).toEqual({ bills: false });
    expect(featureFlagsFor(admin)).toEqual({ bills: true });
  });
});
