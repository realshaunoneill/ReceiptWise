import React from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { space, type Tone } from '../theme';
import Text from './Text';

type Props = {
  label: string;
  value?: React.ReactNode;
  /** A second line, under the label or the value. */
  detail?: string;
  icon?: LucideIcon;
  /** Colours the value for a status; the label stays neutral. */
  tone?: Tone;
  onPress?: () => void;
  /** The disclosure chevron; on by default for a row that leads somewhere. */
  chevron?: boolean;
  /** An action rather than a destination: label and icon in green. */
  accent?: boolean;
  destructive?: boolean;
  accessibilityHint?: string;
};

/** One label and value: the shape of an iOS Settings row. */
export default function Row({ label, value, detail, icon: Icon, tone, onPress, chevron, accent, destructive, accessibilityHint }: Props) {
  const { colors } = useTheme();
  const showChevron = chevron ?? (!!onPress && !accent && !destructive);
  const labelInk = destructive ? 'bad' : accent ? 'accent' : 'primary';
  const iconColor = destructive ? colors.bad : accent ? colors.accent : colors.textSecondary;
  const valueInk = tone === 'good' ? 'good' : tone === 'warn' ? 'warn' : tone === 'bad' ? 'bad' : onPress ? 'muted' : 'primary';

  const valueNode = typeof value === 'string' || typeof value === 'number'
    ? <Text variant="callout" ink={valueInk} align="right" tabular>{value}</Text>
    : value;

  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 13, minHeight: 50, gap: space.md }}>
      {Icon && <Icon size={20} color={iconColor} strokeWidth={1.9} />}
      <View style={{ flexShrink: 1, gap: 2 }}>
        <Text variant="callout" ink={labelInk} weight={accent || destructive ? 'semibold' : undefined}>{label}</Text>
        {!!detail && <Text variant="footnote" ink="muted">{detail}</Text>}
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>{valueNode}</View>
      {showChevron && <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.cardPressed : 'transparent' })}
    >
      {body}
    </Pressable>
  );
}
