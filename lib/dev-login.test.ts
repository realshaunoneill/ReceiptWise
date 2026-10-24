import { describe, expect, it } from 'vitest';
import { isDevLoginEnabled, isTestEmail } from './dev-login';

describe('isDevLoginEnabled', () => {
  const on = { RECEIPTWISE_DEV_LOGIN: '1' };

  it('needs the opt-in', () => {
    expect(isDevLoginEnabled({})).toBe(false);
    expect(isDevLoginEnabled({ RECEIPTWISE_DEV_LOGIN: 'true' })).toBe(false);
    expect(isDevLoginEnabled(on)).toBe(true);
  });

  it('on Vercel, is on for the staging branch preview only', () => {
    expect(isDevLoginEnabled({ ...on, VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'staging' })).toBe(true);
    expect(isDevLoginEnabled({ ...on, VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/x' })).toBe(false);
    expect(isDevLoginEnabled({ ...on, VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'staging' })).toBe(false);
    expect(isDevLoginEnabled({ ...on, VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'master' })).toBe(false);
    expect(isDevLoginEnabled({ ...on, VERCEL: '1' })).toBe(false);
  });
});

describe('isTestEmail', () => {
  it('accepts only the reserved test domain', () => {
    expect(isTestEmail('claude@receiptwise.test')).toBe(true);
    expect(isTestEmail(' Claude@ReceiptWise.TEST ')).toBe(true);
    expect(isTestEmail('someone@gmail.com')).toBe(false);
    expect(isTestEmail('someone@receiptwise.test.example.com')).toBe(false);
    expect(isTestEmail('someone@evilreceiptwise.test')).toBe(false);
    expect(isTestEmail(null)).toBe(false);
  });
});
