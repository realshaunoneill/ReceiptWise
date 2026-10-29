import { colors as tokens } from '@shared/design/tokens';

/**
 * The app's colours: the website's tokens (shared/design/tokens.ts, from app/globals.css), named
 * for how a screen uses them, plus the few a native screen needs that the web doesn't have (a
 * grouped background, a pressed card, a field). DESIGN.md explains the choices: one green that
 * marks what can be pressed, and status colours that only ever mark a status.
 */

/** A hex colour at an opacity, as #rrggbbaa. */
const alpha = (hex: string, opacity: number) => `${hex}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;

const light = {
  // iOS-style grouped background: cards sit a step above the page.
  background: tokens.light.muted,
  card: tokens.light.card,
  cardPressed: tokens.light.accent,
  field: tokens.light.secondary,
  border: tokens.light.border,
  separator: tokens.light.border,
  text: tokens.light.foreground,
  textSecondary: '#525252',
  textMuted: tokens.light.mutedForeground,
  accent: tokens.light.primary,
  accentSoft: alpha(tokens.light.primary, 0.1),
  onAccent: tokens.light.primaryForeground,
  good: tokens.light.success,
  goodSoft: alpha(tokens.light.success, 0.1),
  warn: tokens.light.warning,
  warnSoft: alpha(tokens.light.warning, 0.1),
  bad: tokens.light.destructive,
  badSoft: alpha(tokens.light.destructive, 0.08),
  info: tokens.light.info,
  skeleton: tokens.light.border,
  scrim: 'rgba(10, 10, 10, 0.4)',
  chart: tokens.light.chart1,
  category: {
    food: tokens.light.categoryFood,
    transport: tokens.light.categoryTransport,
    shopping: tokens.light.categoryShopping,
    health: tokens.light.categoryHealth,
    bills: tokens.light.categoryBills,
    leisure: tokens.light.categoryLeisure,
    neutral: tokens.light.categoryNeutral,
  },
};

/** The palette's shape, with every colour widened to a string (the tokens are literal types). */
type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type ThemeColors = Widen<typeof light>;

const dark: ThemeColors = {
  background: tokens.dark.background,
  card: tokens.dark.card,
  cardPressed: tokens.dark.accent,
  field: tokens.dark.accent,
  border: tokens.dark.border,
  separator: tokens.dark.border,
  text: tokens.dark.foreground,
  textSecondary: '#b4b8bd',
  textMuted: tokens.dark.mutedForeground,
  accent: tokens.dark.primary,
  accentSoft: alpha(tokens.dark.primary, 0.14),
  onAccent: tokens.dark.primaryForeground,
  good: tokens.dark.success,
  goodSoft: alpha(tokens.dark.success, 0.14),
  warn: tokens.dark.warning,
  warnSoft: alpha(tokens.dark.warning, 0.14),
  // The web keeps #e7000b in dark mode, which is under 4.5:1 as text on the dark page.
  bad: '#ff6467',
  badSoft: alpha('#ff6467', 0.14),
  info: tokens.dark.info,
  skeleton: tokens.dark.border,
  scrim: 'rgba(0, 0, 0, 0.6)',
  chart: tokens.dark.chart1,
  category: {
    food: tokens.dark.categoryFood,
    transport: tokens.dark.categoryTransport,
    shopping: tokens.dark.categoryShopping,
    health: tokens.dark.categoryHealth,
    bills: tokens.dark.categoryBills,
    leisure: tokens.dark.categoryLeisure,
    neutral: tokens.dark.categoryNeutral,
  },
};

export const palette: Record<'light' | 'dark', ThemeColors> = { light, dark };

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

/** The ink and tint for a status. */
export const toneColors = (colors: ThemeColors, tone: Tone) => ({
  good: { ink: colors.good, soft: colors.goodSoft },
  warn: { ink: colors.warn, soft: colors.warnSoft },
  bad: { ink: colors.bad, soft: colors.badSoft },
  neutral: { ink: colors.textSecondary, soft: colors.field },
}[tone]);

/** A 4-point grid. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

/** The web's radius steps (8 base), plus a pill. Cards and sheets use lg. */
export const radius = { sm: 6, md: 8, lg: 12, xl: 16, pill: 999 };

/** Horizontal inset for screen content, so every edge lines up. */
export const GUTTER = 16;

/**
 * On a wide window (an iPad, an Android tablet, or a phone app stretched across one), the content
 * keeps to a column this wide in the middle, as iOS's own apps keep to their readable width: the
 * same screens as on a phone, never a line of text or a row of figures across a whole iPad.
 */
export const READABLE_WIDTH = 720;

/** For a ScrollView's content (or any full-width column): the readable column, centred. */
export const readableColumn = { width: '100%', maxWidth: READABLE_WIDTH, alignSelf: 'center' } as const;
