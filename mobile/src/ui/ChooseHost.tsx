import React, { useSyncExternalStore } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { GUTTER, radius, space } from '../theme';
import Text from './Text';

/**
 * Android's action sheet. An Android alert holds three buttons, so src/confirm.ts's choose() with
 * a longer list (a menu, a currency, a frequency) dropped the rest without a word. This draws the
 * list as a sheet from the bottom instead; it's mounted once, in app/_layout.tsx.
 */

type Request = { title: string; choices: { label: string; destructive?: boolean }[]; resolve: (index: number | null) => void };

let request: Request | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function requestChoice(title: string, choices: Request['choices']): Promise<number | null> {
  // A new menu replaces one still open; the old one counts as cancelled.
  request?.resolve(null);
  return new Promise((resolve) => {
    request = { title, choices, resolve };
    emit();
  });
}

function settle(index: number | null) {
  const current = request;
  request = null;
  emit();
  current?.resolve(index);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const read = () => request;

export default function ChooseHost() {
  const current = useSyncExternalStore(subscribe, read, read);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const side = Math.max(0, (width - 520) / 2);
  return (
    <Modal visible={!!current} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={() => settle(null)}>
      <Pressable style={{ flex: 1, backgroundColor: colors.scrim }} onPress={() => settle(null)} accessibilityLabel="Cancel" />
      {/* A tablet's sheet keeps to a phone's width, in the middle of the bottom edge. */}
      <View style={{ position: 'absolute', left: side, right: side, bottom: 0, paddingHorizontal: GUTTER, paddingBottom: insets.bottom + space.md, gap: space.sm }}>
        <View style={{ backgroundColor: colors.card, borderRadius: radius.xl, overflow: 'hidden', maxHeight: 520 }}>
          {!!current?.title && (
            <Text variant="footnote" ink="muted" align="center" style={{ paddingHorizontal: space.lg, paddingVertical: space.md }} accessibilityRole="header">{current.title}</Text>
          )}
          <ScrollView bounces={false}>
            {current?.choices.map((choice, index) => (
              <Pressable
                key={`${index}-${choice.label}`}
                onPress={() => settle(index)}
                accessibilityRole="button"
                style={({ pressed }) => ({ minHeight: 52, justifyContent: 'center', paddingHorizontal: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, backgroundColor: pressed ? colors.cardPressed : 'transparent' })}
              >
                <Text variant="body" align="center" ink={choice.destructive ? 'bad' : 'accent'}>{choice.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <Pressable
          onPress={() => settle(null)}
          accessibilityRole="button"
          style={({ pressed }) => ({ minHeight: 52, justifyContent: 'center', borderRadius: radius.xl, backgroundColor: pressed ? colors.cardPressed : colors.card })}
        >
          <Text variant="body" weight="semibold" align="center" ink="accent">Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
