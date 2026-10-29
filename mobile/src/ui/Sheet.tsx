import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { GUTTER, readableColumn, space } from '../theme';
import { tap } from './Button';
import Text from './Text';

type Action = { label: string; onPress: () => void; loading?: boolean; disabled?: boolean };

type Props = {
  title: string;
  /** The one thing the sheet does (Save, Add), top right as on iOS. */
  action?: Action;
  /** "Cancel" by default; "Done" for a sheet that only shows things. */
  closeLabel?: string;
  /** A modal that covers the screen: on Android it starts under the status bar. */
  fullScreen?: boolean;
  /** Content that scrolls itself (a list): no ScrollView around it. */
  scroll?: boolean;
  children: React.ReactNode;
};

/**
 * The frame of every sheet and modal: Cancel, the title and its action across the top, and the
 * content scrolling above the keyboard. Closes with navigation.goBack(): after a swipe down,
 * router.back() would pop the screen underneath as well.
 */
export default function SheetScreen({ title, action, closeLabel = 'Cancel', fullScreen, scroll = true, children }: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const inactive = action?.disabled || action?.loading;

  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={{ ...readableColumn, paddingHorizontal: GUTTER, paddingTop: space.sm, paddingBottom: insets.bottom + space.xxl, gap: space.lg }}
    >
      {children}
    </ScrollView>
  ) : children;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: fullScreen && Platform.OS === 'android' ? insets.top : 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: space.sm, paddingTop: Platform.OS === 'ios' ? space.sm : 0 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" style={{ minWidth: 76, minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm }}>
          <Text variant="body" ink="accent">{closeLabel}</Text>
        </Pressable>
        <Text variant="label" align="center" numberOfLines={1} accessibilityRole="header" style={{ flex: 1 }}>{title}</Text>
        <View style={{ minWidth: 76, alignItems: 'flex-end' }}>
          {!!action && (
            <Pressable
              onPress={() => {
                tap();
                action.onPress();
              }}
              disabled={inactive}
              hitSlop={8}
              accessibilityRole="button"
              aria-disabled={!!inactive}
              aria-busy={!!action.loading}
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm, opacity: action.disabled ? 0.4 : 1 }}
            >
              {action.loading ? <ActivityIndicator color={colors.accent} /> : <Text variant="body" weight="semibold" ink="accent">{action.label}</Text>}
            </Pressable>
          )}
        </View>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {body}
      </KeyboardAvoidingView>
    </View>
  );
}
