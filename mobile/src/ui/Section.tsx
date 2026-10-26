import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { GUTTER, radius, space } from '../theme';
import Text from './Text';

type SectionProps = {
  title?: string;
  /** Opposite the title: a total, or a small plain button. */
  accessory?: React.ReactNode;
  /** Small print under the card. */
  footer?: string;
  children: React.ReactNode;
  style?: ViewStyle;
};

/**
 * A titled group, inset-grouped like iOS Settings: the heading outside the card, any small print
 * under it, so the card itself only holds content.
 */
export function Section({ title, accessory, footer, children, style }: SectionProps) {
  return (
    <View style={[{ marginHorizontal: GUTTER, marginBottom: space.xxl }, style]}>
      {(!!title || !!accessory) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm, paddingHorizontal: space.xs, minHeight: 28 }}>
          {!!title && <Text variant="heading" accessibilityRole="header">{title}</Text>}
          {accessory}
        </View>
      )}
      {children}
      {!!footer && <Text variant="footnote" ink="muted" style={{ marginTop: space.sm, paddingHorizontal: space.xs }}>{footer}</Text>}
    </View>
  );
}

/** The surface that holds rows or a block of content: a hairline edge and no shadow. */
export function Card({ children, padded, style }: { children: React.ReactNode; padded?: boolean; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
        padded && { padding: space.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Rows in a card, with an inset hairline between each. Falsy children are skipped. */
export function List({ children, inset = space.lg }: { children: React.ReactNode; inset?: number }) {
  const { colors } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <Card>
      {rows.map((row, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: inset }} />}
          {row}
        </React.Fragment>
      ))}
    </Card>
  );
}
