import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { usePathname, type ErrorBoundaryProps } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SUPPORT_EMAIL } from '../config';
import { reportError } from '../crashes';
import { useTheme } from '../contexts/ThemeContext';
import { GUTTER, radius, space } from '../theme';
import Button from '../ui/Button';
import Text from '../ui/Text';
import Logo from './Logo';

/**
 * What a crash shows instead of a blank screen: an apology and a way back in. It also sends the
 * error to the website's logs (POST /api/app-errors, signed in only), so a failure on a phone can
 * be read without the phone, and offers the details to quote in an email.
 */
export default function ErrorScreen({ error, retry, underHeader }: ErrorBoundaryProps & { underHeader?: boolean }) {
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  const path = usePathname();
  const [details, setDetails] = useState(false);
  const sent = useRef<Error | null>(null);

  useEffect(() => {
    if (sent.current === error) return;
    sent.current = error;
    reportError(error, path);
  }, [error, path]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: (underHeader ? 0 : insets.top) + space.xxxl, paddingBottom: insets.bottom + space.xl, paddingHorizontal: GUTTER + space.xs, gap: space.lg }}>
      <Logo size={40} dark={theme === 'dark'} />
      <Text variant="title" accessibilityRole="header">Something went wrong</Text>
      <Text variant="callout" ink="secondary">{`That's on us, not you, and we've been told. Try again, and if it keeps happening, tell us at ${SUPPORT_EMAIL}.`}</Text>
      {details ? (
        <ScrollView style={{ maxHeight: 220, backgroundColor: colors.card, borderRadius: radius.lg }} contentContainerStyle={{ padding: space.md }}>
          <Text variant="footnote" weight="mono" selectable>{`${error?.message ?? String(error)}\n\n${path ?? ''}`}</Text>
        </ScrollView>
      ) : (
        <Button label="Show details" variant="plain" size="sm" onPress={() => setDetails(true)} style={{ alignSelf: 'flex-start' }} />
      )}
      <View style={{ flex: 1 }} />
      <Button label="Try again" onPress={() => void retry()} />
    </View>
  );
}
