import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { maskAmounts, usePrivacy } from '../privacy';
import type { ThemeColors } from '../theme';

/**
 * Font families as loaded in app/_layout.tsx. React Native picks a custom font by family name, not
 * by fontWeight (Android ignores the weight and falls back to the system font), so every weight is
 * its own family. IBM Plex, as on the website; Mono for receipt numbers, the forwarding address and
 * ids.
 */
export const FONT = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

/** The type scale (DESIGN.md): the web's, in points. */
const VARIANTS = {
  largeTitle: { fontFamily: FONT.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  title: { fontFamily: FONT.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  heading: { fontFamily: FONT.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.1 },
  body: { fontFamily: FONT.regular, fontSize: 16, lineHeight: 22 },
  callout: { fontFamily: FONT.regular, fontSize: 15, lineHeight: 20 },
  label: { fontFamily: FONT.semibold, fontSize: 15, lineHeight: 20 },
  footnote: { fontFamily: FONT.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: FONT.medium, fontSize: 12, lineHeight: 16 },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof VARIANTS;

type Ink = 'primary' | 'secondary' | 'muted' | 'accent' | 'good' | 'warn' | 'bad' | 'onAccent';

const INK: Record<Ink, keyof ThemeColors> = {
  primary: 'text',
  secondary: 'textSecondary',
  muted: 'textMuted',
  accent: 'accent',
  good: 'good',
  warn: 'warn',
  bad: 'bad',
  onAccent: 'onAccent',
};

type Props = TextProps & {
  variant?: TextVariant;
  ink?: Ink;
  /** Overrides the variant's weight, e.g. a bold run inside body copy. */
  weight?: keyof typeof FONT;
  align?: TextStyle['textAlign'];
  /** Tabular figures, for numbers that sit in columns or change in place. */
  tabular?: boolean;
};

/** Amounts masked while hide amounts is on (src/privacy.ts): every amount is drawn through here. */
function masked(children: React.ReactNode): React.ReactNode {
  if (typeof children === 'string') return maskAmounts(children);
  if (Array.isArray(children)) return children.map((child) => (typeof child === 'string' ? maskAmounts(child) : child));
  return children;
}

export default function Text({ variant = 'body', ink = 'primary', weight, align, tabular, style, children, accessibilityLabel, ...rest }: Props) {
  const { colors } = useTheme();
  const { hideAmounts } = usePrivacy();
  return (
    <RNText
      {...rest}
      accessibilityLabel={hideAmounts && accessibilityLabel ? maskAmounts(accessibilityLabel) : accessibilityLabel}
      style={[
        VARIANTS[variant],
        { color: colors[INK[ink]] as string },
        weight && { fontFamily: FONT[weight] },
        align && { textAlign: align },
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
    >
      {hideAmounts ? masked(children) : children}
    </RNText>
  );
}
