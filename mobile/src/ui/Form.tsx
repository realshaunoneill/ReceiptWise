import React, { forwardRef, useState } from 'react';
import { Platform, Pressable, Switch, TextInput, View, type TextInputInstance } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { ChevronDown } from 'lucide-react-native';
import { formatLocalDate } from '@shared/dates/local-date';
import { choose } from '../confirm';
import { useTheme } from '../contexts/ThemeContext';
import { radius, space } from '../theme';
import { selectionTick } from './Button';
import { Field } from './Controls';
import Text, { FONT } from './Text';

/**
 * Form controls for sheets, all the shape of Field (a label over a filled box) so a form reads as
 * one column: amounts, dates, a choice from a short list, and on/off.
 */

type MoneyProps = Omit<React.ComponentProps<typeof Field>, 'inputMode'>;

/** An amount: the decimal keypad (numbers-and-punctuation where it can be negative), figures in columns. */
export const MoneyField = forwardRef<TextInputInstance, MoneyProps>((props, ref) => (
  <Field ref={ref} keyboardType="decimal-pad" inputMode="decimal" placeholder="0.00" {...props} style={[{ fontFamily: FONT.medium, fontVariant: ['tabular-nums'] }, props.style]} />
));
MoneyField.displayName = 'MoneyField';

/** The filled box Field draws, for controls that aren't a text input. */
function Box({ label, hint, error, children, onPress, accessibilityLabel, value }: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  value?: string;
}) {
  const { colors } = useTheme();
  const box = { backgroundColor: colors.field, borderRadius: radius.lg, paddingHorizontal: 14, minHeight: 48, flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.sm, borderWidth: error ? 1.5 : 0, borderColor: colors.bad };
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}</Text>
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityValue={value ? { text: value } : undefined} style={({ pressed }) => [box, pressed && { opacity: 0.7 }]}>
          {children}
        </Pressable>
      ) : (
        <View style={box}>{children}</View>
      )}
      {(!!hint || !!error) && <Text variant="footnote" ink={error ? 'bad' : 'muted'} style={{ paddingHorizontal: space.xs }}>{error ?? hint}</Text>}
    </View>
  );
}

type PickerProps<T extends string> = {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: string;
};

/** One of a short list: the action sheet on iOS, an alert on Android. */
export function PickerField<T extends string>({ label, value, options, onChange, hint }: PickerProps<T>) {
  const { colors } = useTheme();
  const current = options.find((option) => option.value === value)?.label ?? '';
  return (
    <Box
      label={label}
      hint={hint}
      value={current}
      onPress={async () => {
        const index = await choose(label, options.map((option) => ({ label: option.value === value ? `${option.label} ✓` : option.label })));
        if (index !== null && options[index].value !== value) {
          selectionTick();
          onChange(options[index].value);
        }
      }}
    >
      <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>{current}</Text>
      <ChevronDown size={18} color={colors.textMuted} />
    </Box>
  );
}

const toDate = (day: string) => new Date(`${day}T12:00:00`);
const toDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

type DateProps = {
  label: string;
  /** YYYY-MM-DD, or null for none (with `optional`). */
  value: string | null;
  onChange: (day: string | null) => void;
  optional?: boolean;
  hint?: string;
};

/**
 * A day: the system's date picker (a compact one on iOS, the dialog on Android); typed as
 * YYYY-MM-DD in the web preview, which has no picker.
 */
export function DateField({ label, value, onChange, optional, hint }: DateProps) {
  const { colors, theme } = useTheme();
  const [typed, setTyped] = useState(value ?? '');
  const shown = value ? formatLocalDate(value, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }, 'en-IE') : 'None';
  const clear = optional && !!value ? (
    <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Clear ${label}`}>
      <Text variant="callout" ink="accent">Clear</Text>
    </Pressable>
  ) : null;

  if (Platform.OS === 'web') {
    return (
      <Field
        label={label}
        hint={hint ?? 'YYYY-MM-DD'}
        value={typed}
        placeholder={optional ? 'None' : 'YYYY-MM-DD'}
        onChangeText={(text) => {
          setTyped(text);
          if (/^\d{4}-\d{2}-\d{2}$/.test(text)) onChange(text);
          else if (!text && optional) onChange(null);
        }}
      />
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <Box label={label} hint={hint}>
        {value ? (
          <DateTimePicker
            value={toDate(value)}
            mode="date"
            display="compact"
            themeVariant={theme}
            accentColor={colors.accent}
            onChange={(_event, date) => date && onChange(toDay(date))}
            style={{ marginLeft: -8 }}
          />
        ) : (
          <Pressable onPress={() => onChange(toDay(new Date()))} accessibilityRole="button" style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}>
            <Text variant="body" ink="muted">None · tap to set</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        {clear}
      </Box>
    );
  }

  return (
    <Box
      label={label}
      hint={hint}
      value={shown}
      onPress={() => DateTimePickerAndroid.open({
        value: value ? toDate(value) : new Date(),
        mode: 'date',
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(toDay(date));
        },
      })}
    >
      <Text variant="body" style={{ flex: 1 }} ink={value ? 'primary' : 'muted'}>{shown}</Text>
      {clear}
    </Box>
  );
}

/** On or off, with what it means underneath. */
export function SwitchField({ label, detail, value, onChange, disabled }: { label: string; detail?: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.field, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: space.md, minHeight: 52 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body">{label}</Text>
        {!!detail && <Text variant="footnote" ink="muted">{detail}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={(next) => {
          selectionTick();
          onChange(next);
        }}
        disabled={disabled}
        trackColor={{ true: colors.accent, false: colors.border }}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** Quick picks under a field: the usual items, a few amounts. */
export function Chips({ items, onPick, label }: { items: { key: string; label: string; hint?: string }[]; onPick: (key: string) => void; label: string }) {
  const { colors } = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={{ gap: 6 }}>
      <Text variant="footnote" ink="muted">{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} accessibilityRole="list">
        {items.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => {
              selectionTick();
              onPick(item.key);
            }}
            accessibilityRole="button"
            accessibilityHint={item.hint}
            style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.cardPressed : colors.card })}
          >
            <Text variant="footnote" ink="secondary">{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** A text field that grows with what's typed, in Mono (pasted lists line up). */
export const ListField = forwardRef<TextInputInstance, React.ComponentProps<typeof TextInput> & { label: string }>(({ label, ...rest }, ref) => (
  <Field ref={ref} label={label} multiline mono autoCorrect={false} autoCapitalize="sentences" {...rest} />
));
ListField.displayName = 'ListField';
