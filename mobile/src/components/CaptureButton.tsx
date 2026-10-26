import React from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { tap } from '../ui/Button';

/** The header's camera: add a receipt from anywhere it shows. */
export default function CaptureButton() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => {
        tap();
        router.push('/capture');
      }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Add a receipt"
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
    >
      <Camera size={24} color={colors.accent} strokeWidth={2} />
    </Pressable>
  );
}
