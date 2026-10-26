import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import { radius, space } from '../theme';
import { selectionTick } from './Button';
import Text from './Text';

export type PickerOption<T extends string> = { value: T; label: string; detail?: string };
export type PickerGroup<T extends string> = { label?: string; options: PickerOption<T>[] };

type Props<T extends string> = {
  label: string;
  value: T;
  /** One list, or headed groups (categories). */
  groups: PickerGroup<T>[];
  onChange: (value: T) => void;
  hint?: string;
  /** Shown when the value isn't one of the options. */
  placeholder?: string;
};

/**
 * One of a list, opened in place under the field, the shape of Field. For lists longer than a
 * couple of choices: an Android alert holds only three buttons, so a long list can't go through
 * src/confirm.ts's choose().
 */
export default function InlinePicker<T extends string>({ label, value, groups, onChange, hint, placeholder = 'Choose' }: Props<T>) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const current = groups.flatMap((group) => group.options).find((option) => option.value === value);
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}</Text>
      <View style={{ backgroundColor: colors.field, borderRadius: radius.lg, overflow: 'hidden' }}>
        <Pressable
          onPress={() => setOpen(!open)}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{ text: current?.label ?? placeholder }}
          aria-expanded={open}
          style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.7 : 1 })}
        >
          <Text variant="body" ink={current ? 'primary' : 'muted'} style={{ flex: 1 }} numberOfLines={1}>{current?.label ?? placeholder}</Text>
          <Chevron size={18} color={colors.textMuted} />
        </Pressable>
        {open && groups.map((group, groupIndex) => (
          <View key={group.label ?? groupIndex} accessibilityRole="radiogroup" accessibilityLabel={group.label ?? label}>
            {!!group.label && (
              <Text variant="caption" ink="muted" style={{ paddingHorizontal: 14, paddingTop: space.md, paddingBottom: space.xs }}>{group.label.toUpperCase()}</Text>
            )}
            {group.options.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    if (!selected) {
                      selectionTick();
                      onChange(option.value);
                    }
                    setOpen(false);
                  }}
                  accessibilityRole="radio"
                  aria-checked={selected}
                  style={({ pressed }) => ({
                    minHeight: 44, paddingHorizontal: 14, paddingVertical: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm,
                    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, backgroundColor: pressed ? colors.cardPressed : 'transparent',
                  })}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="callout" weight={selected ? 'semibold' : undefined}>{option.label}</Text>
                    {!!option.detail && <Text variant="footnote" ink="muted">{option.detail}</Text>}
                  </View>
                  {selected && <Check size={18} color={colors.accent} strokeWidth={2.5} />}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      {!!hint && <Text variant="footnote" ink="muted" style={{ paddingHorizontal: space.xs }}>{hint}</Text>}
    </View>
  );
}
