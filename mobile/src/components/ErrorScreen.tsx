import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ErrorBoundaryProps } from 'expo-router';
import { SUPPORT_EMAIL } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import { GUTTER, space } from '../theme';
import Button from '../ui/Button';
import Text from '../ui/Text';
import Logo from './Logo';

/** What a crash shows instead of a blank screen: an apology and a way back in. */
export default function ErrorScreen({ retry, underHeader }: ErrorBoundaryProps & { underHeader?: boolean }) {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: (underHeader ? 0 : insets.top) + space.xxxl, paddingBottom: insets.bottom + space.xl, paddingHorizontal: GUTTER + space.xs, gap: space.lg }}>
      <Logo size={40} dark={theme === 'dark'} />
      <Text variant="title" accessibilityRole="header">Something went wrong</Text>
      <Text variant="callout" ink="secondary">{`That's on us, not you. Try again, and if it keeps happening, tell us at ${SUPPORT_EMAIL}.`}</Text>
      <View style={{ flex: 1 }} />
      <Button label="Try again" onPress={() => void retry()} />
    </View>
  );
}
