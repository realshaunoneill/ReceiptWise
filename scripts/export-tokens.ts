// Write the website's colour tokens (app/globals.css) to shared/design/tokens.ts as hex, for the
// app. Run after changing a colour in globals.css: npm run tokens
// shared/design/tokens.test.ts fails while the two disagree.

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { buildTokens } from '../shared/design/build-tokens';

const root = join(__dirname, '..');
const { light, dark } = buildTokens(readFileSync(join(root, 'app/globals.css'), 'utf8'));

const block = (set: Record<string, string>) =>
  Object.entries(set).map(([name, hex]) => `    ${name}: '${hex}',`).join('\n');

writeFileSync(join(root, 'shared/design/tokens.ts'), `// Generated from app/globals.css by scripts/export-tokens.ts (npm run tokens). Don't edit by hand.

export const colors = {
  light: {
${block(light)}
  },
  dark: {
${block(dark)}
  },
} as const;

export type ColorName = keyof typeof colors.light;

/** Corner radii in points: the web's --radius (0.5rem) and the steps derived from it. */
export const radius = { sm: 4, md: 6, lg: 8, xl: 12 } as const;
`);
console.log(`shared/design/tokens.ts: ${Object.keys(light).length} colours, light and dark`);
