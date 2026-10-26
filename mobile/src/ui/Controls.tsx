import React, { forwardRef } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { radius, space } from '../theme';
import { selectionTick } from './Button';
import Text, { FONT } from './Text';

type SegmentedProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

/** An iOS-style segmented control. */
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedProps<T>) {
  const { colors, theme } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={{ flexDirection: 'row', backgroundColor: colors.field, borderRadius: 10, padding: 3 }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!selected) {
                selectionTick();
                onChange(option.value);
              }
            }}
            accessibilityRole="radio"
            aria-checked={selected}
            style={{
              flex: 1, minHeight: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
              backgroundColor: selected ? (theme === 'dark' ? colors.border : colors.card) : 'transparent',
              borderWidth: selected && theme === 'light' ? StyleSheet.hairlineWidth : 0,
              borderColor: colors.border,
            }}
          >
            <Text variant="footnote" weight={selected ? 'semibold' : 'medium'} ink={selected ? 'primary' : 'secondary'}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type FieldProps = TextInputProps & {
  label: string;
  /** Under the field; replaced by `error` when there is one. */
  hint?: string;
  error?: string | null;
  mono?: boolean;
};

/** A labelled text field with its hint or error. */
export const Field = forwardRef<TextInputInstance, FieldProps>(({ label, hint, error, mono, style, ...rest }, ref) => {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        accessibilityLabel={label}
        {...rest}
        style={[
          {
            backgroundColor: colors.field, borderRadius: radius.lg, borderWidth: error ? 1.5 : 0, borderColor: colors.bad,
            paddingHorizontal: 14, paddingVertical: 13, fontFamily: mono ? FONT.mono : FONT.regular, fontSize: 16, color: colors.text,
          },
          rest.multiline && { minHeight: 120, paddingTop: 13, textAlignVertical: 'top' },
          style,
        ]}
      />
      {(!!hint || !!error) && (
        <Text variant="footnote" ink={error ? 'bad' : 'muted'} style={{ paddingHorizontal: space.xs }}>{error ?? hint}</Text>
      )}
    </View>
  );
});
Field.displayName = 'Field';
