/**
 * The website's colour tokens (app/globals.css, written in oklch) as hex for the app, which has
 * no oklch. scripts/export-tokens.ts writes the result to shared/design/tokens.ts, and a test
 * checks that file still matches the CSS, so the two never drift.
 */

export type TokenSet = Record<string, string>;

/** oklch(L C H) to sRGB hex, clipped to the sRGB gamut (Björn Ottosson's OKLab matrices). */
export function oklchToHex(l: number, c: number, h: number): string {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return `#${linear
    .map((x) => {
      const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055;
      return Math.round(Math.min(Math.max(v, 0), 1) * 255).toString(16).padStart(2, '0');
    })
    .join('')}`;
}

/** `--card-foreground` → `cardForeground`, `--chart-1` → `chart1`. */
function tokenName(variable: string): string {
  return variable.replace(/-([a-z0-9])/g, (_, ch: string) => ch.toUpperCase());
}

/** The `--name: oklch(…)` declarations in one CSS block, skipping the web-only sidebar set. */
function readBlock(css: string, selector: string): TokenSet {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No ${selector} block in the CSS`);
  const body = css.slice(start, css.indexOf('\n}', start));
  const tokens: TokenSet = {};
  for (const match of body.matchAll(/--([a-z0-9-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g)) {
    const [, variable, l, c, h] = match;
    if (variable.startsWith('sidebar')) continue;
    tokens[tokenName(variable)] = oklchToHex(Number(l), Number(c), Number(h));
  }
  return tokens;
}

/** Light and dark colours. Dark starts from light, as `.dark` overrides `:root` in CSS. */
export function buildTokens(css: string): { light: TokenSet; dark: TokenSet } {
  const light = readBlock(css, ':root');
  return { light, dark: { ...light, ...readBlock(css, '.dark') } };
}
