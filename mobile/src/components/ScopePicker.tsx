import React from 'react';
import { ActivityIndicator, Platform, Pressable } from 'react-native';
import { ChevronDown, Users } from 'lucide-react-native';
import { choose } from '../confirm';
import { useTheme } from '../contexts/ThemeContext';
import { useHouseholds } from '../hooks/useHouseholds';
import { useMe } from '../hooks/useMe';
import { useScope } from '../scope';
import { GUTTER, radius, space } from '../theme';
import { selectionTick } from '../ui/Button';
import Text from '../ui/Text';

type Props = {
  /** The new scope's figures are still loading: a spinner in place of the chevron. */
  loading?: boolean;
  /** In the header (iOS): plain accent text, as the bar's own buttons are. */
  compact?: boolean;
  /** First in a screen's content: with the screen's margins (none at all when it isn't shown). */
  inline?: boolean;
};

/**
 * "Just me" or a household: whose plan and totals are on screen (src/scope.ts). Only shown when a
 * household's plan can be seen, which needs someone in it on Premium.
 */
export default function ScopePicker({ loading, compact, inline }: Props) {
  const { colors } = useTheme();
  const me = useMe();
  const households = useHouseholds();
  const { householdId, setScope } = useScope();
  const shared = (households.data ?? []).filter((household) => me.data?.entitlements.householdIds.includes(household.id));
  if (shared.length === 0) return null;
  const options = [{ id: null as string | null, name: 'Just me' }, ...shared.map((household) => ({ id: household.id as string | null, name: household.name }))];
  const current = options.find((option) => option.id === (householdId ?? null)) ?? options[0];
  const ink = compact ? colors.accent : colors.textSecondary;

  return (
    <Pressable
      onPress={async () => {
        const index = await choose('Show', options.map((option) => ({ label: option.id === current.id ? `${option.name} ✓` : option.name })));
        if (index !== null && options[index].id !== current.id) {
          selectionTick();
          setScope(options[index].id);
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={loading ? `Loading ${current.name}` : `Showing ${current.name}. Change`}
      aria-busy={!!loading}
      hitSlop={8}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', minHeight: 36, opacity: pressed ? 0.6 : 1 },
        !compact && { paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: pressed ? colors.cardPressed : colors.card, borderWidth: 1, borderColor: colors.border },
        compact && { paddingHorizontal: space.xs },
        inline && { marginHorizontal: GUTTER, marginBottom: space.md },
      ]}
    >
      <Users size={compact ? 17 : 15} color={ink} />
      <Text variant={compact ? 'callout' : 'footnote'} weight={compact ? 'semibold' : 'medium'} style={compact ? { color: colors.accent } : undefined} numberOfLines={1}>{current.name}</Text>
      {loading ? <ActivityIndicator size="small" color={ink} style={{ transform: [{ scale: 0.75 }] }} /> : <ChevronDown size={15} color={compact ? colors.accent : colors.textMuted} />}
    </Pressable>
  );
}

/**
 * Where the picker goes on a tab's first screen. On iOS it sits in the header's top row, which a
 * large title otherwise leaves empty on the left (it had a row of its own above the content);
 * elsewhere it's the first thing in the content.
 */
export function scopePickerPlacement(loading: boolean) {
  const inHeader = Platform.OS === 'ios';
  return {
    headerLeft: inHeader ? () => <ScopePicker compact loading={loading} /> : undefined,
    inline: inHeader ? null : <ScopePicker loading={loading} inline />,
  };
}
