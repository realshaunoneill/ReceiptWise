import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { buildTokens, oklchToHex } from './build-tokens';
import { colors } from './tokens';

describe('design tokens', () => {
  it('converts oklch to the hex the brand states', () => {
    expect(oklchToHex(0.53, 0.13, 166)).toBe('#00825a');
    expect(oklchToHex(1, 0, 0)).toBe('#ffffff');
  });

  it('match app/globals.css (run `npm run tokens` after changing a colour there)', () => {
    const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8');
    expect(colors).toEqual(buildTokens(css));
  });
});
