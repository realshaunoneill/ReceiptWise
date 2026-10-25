import { describe, expect, it } from 'vitest';
import { isAllowedExtension, isExtensionId } from './extension-connect';

const STORE_ID = 'abcdefghijklmnopabcdefghijklmnop';
const OTHER_ID = 'ponmlkjihgfedcbaponmlkjihgfedcba';

describe('extension connect', () => {
  it('only takes well-formed extension ids', () => {
    expect(isExtensionId(STORE_ID)).toBe(true);
    expect(isExtensionId('abc')).toBe(false);
    expect(isExtensionId('ABCDEFGHIJKLMNOPABCDEFGHIJKLMNOP')).toBe(false);
    expect(isExtensionId(`${STORE_ID}q`)).toBe(false);
  });

  it('accepts any well-formed id until EXTENSION_IDS is set, then only those', () => {
    expect(isAllowedExtension(OTHER_ID, undefined)).toBe(true);
    expect(isAllowedExtension(OTHER_ID, '')).toBe(true);
    expect(isAllowedExtension(STORE_ID, ` ${STORE_ID} , ${'a'.repeat(32)}`)).toBe(true);
    expect(isAllowedExtension(OTHER_ID, STORE_ID)).toBe(false);
    expect(isAllowedExtension('not-an-id', '')).toBe(false);
  });
});
