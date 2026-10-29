import React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { type LucideIcon } from 'lucide-react-native';
import type { SFSymbol } from 'sf-symbols-typescript';
import { choose } from '../confirm';
import { useTheme } from '../contexts/ThemeContext';
import { space } from '../theme';
import { tap } from './Button';
import Text from './Text';

/** An icon in a stack's header (Add, Filter): 44 pt to tap, in the accent green. Android and the web. */
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

export type HeaderAction = {
  label: string;
  /** The icon iOS draws (an SF Symbol); without one the button is its label, as "Edit" is. */
  sfSymbol?: SFSymbol;
  /** The same icon for Android and the web. */
  icon?: LucideIcon;
  /** A count on the button (filters on): iOS 26's badge, and the label elsewhere. */
  badge?: number;
  /**
   * A menu instead of one action (the account switcher): iOS's native menu, and elsewhere the
   * same choices as a sheet (src/confirm.ts choose), the one on screen ticked.
   */
  menu?: { title: string; items: { label: string; selected?: boolean; onPress: () => void }[] };
  onPress?: () => void;
};

/**
 * A stack's right-hand header buttons, as screen options. On iOS 26 and later a React view in the
 * header sits in a glass bubble sized from the view's own layout, and ours came out as an empty
 * circle that did nothing when tapped (2026-10-29, on TestFlight). So on iOS these are native bar
 * button items, which iOS draws itself in the bar's glass; Android and the web keep HeaderButton.
 */
export function headerActions(actions: HeaderAction[]) {
  const run = (action: HeaderAction) => () => {
    if (action.onPress) {
      action.onPress();
      return;
    }
    const { menu } = action;
    if (!menu) return;
    void choose(menu.title, menu.items.map((item) => ({ label: item.selected ? `${item.label} ✓` : item.label }))).then((index) => {
      if (index !== null) menu.items[index].onPress();
    });
  };
  const press = (action: HeaderAction) => () => {
    tap();
    run(action)();
  };
  if (Platform.OS === 'ios') {
    return {
      unstable_headerRightItems: () => actions.map((action) => (action.menu
        ? {
          type: 'menu' as const,
          label: action.label,
          accessibilityLabel: action.label,
          ...(action.sfSymbol ? { icon: { type: 'sfSymbol' as const, name: action.sfSymbol } } : {}),
          menu: {
            title: action.menu.title,
            items: action.menu.items.map((item) => ({
              type: 'action' as const,
              label: item.label,
              state: item.selected ? 'on' as const : 'off' as const,
              onPress: item.onPress,
            })),
          },
        }
        : {
          type: 'button' as const,
          label: action.label,
          accessibilityLabel: action.badge ? `${action.label}, ${action.badge} on` : action.label,
          ...(action.sfSymbol ? { icon: { type: 'sfSymbol' as const, name: action.sfSymbol } } : {}),
          ...(action.badge ? { badge: { value: action.badge } } : {}),
          onPress: press(action),
        })),
    };
  }
  return {
    headerRight: () => (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
        {actions.map((action) => (action.icon
          ? <HeaderButton key={action.label} icon={action.icon} label={action.badge ? `${action.label}, ${action.badge} on` : action.label} onPress={run(action)} />
          : <TextAction key={action.label} label={action.label} onPress={press(action)} />))}
      </View>
    ),
  };
}

function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}>
      <Text variant="body" ink="accent">{label}</Text>
    </Pressable>
  );
}
