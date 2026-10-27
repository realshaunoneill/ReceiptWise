import React from 'react';
import { Platform, RefreshControl, ScrollView, type ScrollViewProps } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { space } from '../theme';
import { usePullToRefresh } from './usePullToRefresh';

type Props = ScrollViewProps & {
  /** Pull to refresh: the spinner shows until what this returns has settled (src/ui/usePullToRefresh.ts). */
  onRefresh?: () => unknown;
};

/**
 * The scrolling body of a screen in a tab's stack, under a large title. iOS insets the first
 * ScrollView for the header and the tab bar itself (contentInsetAdjustmentBehavior), so content
 * scrolls on under the glass; the stack header covers the top on Android. Don't wrap this in a
 * SafeAreaView as well, or iOS insets the top twice.
 */
export default function TabScreen({ contentContainerStyle, children, onRefresh, ...rest }: Props) {
  const { colors } = useTheme();
  const pull = usePullToRefresh(onRefresh);
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      refreshControl={onRefresh ? <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={colors.textMuted} /> : undefined}
      {...rest}
      style={[{ flex: 1, backgroundColor: colors.background }, rest.style]}
      contentContainerStyle={[
        // The web preview draws native tabs as a bar across the top, so leave room under it.
        { paddingTop: Platform.OS === 'web' ? 64 : space.sm, paddingBottom: space.xxxl * 2 },
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
}
