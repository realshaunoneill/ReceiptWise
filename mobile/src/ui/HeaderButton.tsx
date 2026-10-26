import React from 'react';
import { Pressable } from 'react-native';
import { type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { tap } from './Button';

/** An icon in a stack's header (Add, Filter): 44 pt to tap, in the accent green. */
export default function HeaderButton({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
    >
      <Icon size={24} color={colors.accent} strokeWidth={2} />
    </Pressable>
  );
}
