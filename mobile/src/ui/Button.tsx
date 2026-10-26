import React from 'react';
import { ActivityIndicator, Platform, Pressable, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { radius } from '../theme';
import Text from './Text';

type Variant = 'primary' | 'secondary' | 'plain' | 'destructive';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  /** A light tap on press, for actions that commit something. */
  haptic?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

/** Haptics do nothing on the web preview, but the call warns there. */
export const tap = () => {
  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export const selectionTick = () => {
  if (Platform.OS !== 'web') void Haptics.selectionAsync();
};

export const success = () => {
  if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

/** One green for what can be pressed (DESIGN.md); 50 pt tall, so the tap target is never small. */
export default function Button({
  label, onPress, variant = 'primary', size = 'md', icon: Icon, loading, disabled, haptic, style, accessibilityLabel,
}: Props) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const surface = {
    primary: { bg: colors.accent, ink: colors.onAccent },
    secondary: { bg: colors.field, ink: colors.text },
    plain: { bg: 'transparent', ink: colors.accent },
    destructive: { bg: colors.badSoft, ink: colors.bad },
  }[variant];

  return (
    <Pressable
      onPress={() => {
        if (haptic) tap();
        onPress();
      }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      aria-disabled={!!inactive}
      aria-busy={!!loading}
      hitSlop={size === 'sm' ? 6 : 0}
      style={({ pressed }) => [
        {
          height: size === 'md' ? 50 : 36,
          paddingHorizontal: variant === 'plain' ? 4 : size === 'md' ? 20 : 14,
          borderRadius: radius.lg,
          backgroundColor: surface.bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled && !loading ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={surface.ink} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {Icon && <Icon size={size === 'md' ? 18 : 16} color={surface.ink} strokeWidth={2.2} />}
          <Text variant="label" style={{ color: surface.ink, fontSize: size === 'md' ? 16 : 14 }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
