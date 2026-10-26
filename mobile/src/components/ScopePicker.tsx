import React from 'react';
import { Pressable } from 'react-native';
import { ChevronDown, Users } from 'lucide-react-native';
import { choose } from '../confirm';
import { useTheme } from '../contexts/ThemeContext';
import { useHouseholds } from '../hooks/useHouseholds';
import { useMe } from '../hooks/useMe';
import { useScope } from '../scope';
import { radius, space } from '../theme';
import { selectionTick } from '../ui/Button';
import Text from '../ui/Text';

/**
 * "Just me" or a household: whose plan and totals are on screen (src/scope.ts). Only shown when a
 * household's plan can be seen, which needs someone in it on Premium.
 */
export default function ScopePicker() {
  const { colors } = useTheme();
  const me = useMe();
  const households = useHouseholds();
  const { householdId, setScope } = useScope();
  const shared = (households.data ?? []).filter((household) => me.data?.entitlements.householdIds.includes(household.id));
  if (shared.length === 0) return null;
  const options = [{ id: null as string | null, name: 'Just me' }, ...shared.map((household) => ({ id: household.id as string | null, name: household.name }))];
  const current = options.find((option) => option.id === (householdId ?? null)) ?? options[0];

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
      accessibilityLabel={`Showing ${current.name}. Change`}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: space.md,
        borderRadius: radius.pill, backgroundColor: pressed ? colors.cardPressed : colors.card, borderWidth: 1, borderColor: colors.border,
      })}
    >
      <Users size={15} color={colors.textSecondary} />
      <Text variant="footnote" weight="medium">{current.name}</Text>
      <ChevronDown size={15} color={colors.textMuted} />
    </Pressable>
  );
}
