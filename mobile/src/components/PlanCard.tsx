import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { formatCents } from '@shared/currency';
import { type WirePlan } from '@shared/api/plan';
import { useTheme } from '../contexts/ThemeContext';
import { space } from '../theme';
import { Card } from '../ui/Section';
import { Skeleton } from '../ui/Feedback';
import Text from '../ui/Text';

/**
 * This period at a glance: what's left after everything planned, and the weekly split. A shortfall
 * says "over" rather than showing a minus sign (DESIGN.md).
 */
export default function PlanCard({ plan, loading }: { plan: WirePlan | undefined; loading: boolean }) {
  const { colors } = useTheme();
  const router = useRouter();

  if (loading && !plan) {
    return (
      <Card padded>
        <View style={{ gap: space.sm }}>
          <Skeleton width="40%" />
          <Skeleton width="60%" height={30} />
          <Skeleton width="50%" />
        </View>
      </Card>
    );
  }
  if (!plan) return null;

  const { remainingCents, weeklyCents } = plan.totals;
  const over = remainingCents < 0;
  const noIncome = plan.flags.includes('no_income');

  return (
    <Pressable onPress={() => router.navigate('/plan')} accessibilityRole="button" accessibilityHint="Opens the plan">
      {({ pressed }) => (
        <Card padded style={{ backgroundColor: pressed ? colors.cardPressed : colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="footnote" ink="muted">{`This month's plan · ${plan.period.label}`}</Text>
              {noIncome ? (
                <Text variant="callout" ink="secondary">Add your pay to see what's left each month.</Text>
              ) : (
                <>
                  <Text variant="title" ink={over ? 'bad' : 'primary'} tabular>
                    {`${formatCents(Math.abs(remainingCents), plan.currency)} ${over ? 'over' : 'left'}`}
                  </Text>
                  {!over && <Text variant="footnote" ink="secondary" tabular>{`${formatCents(weeklyCents, plan.currency)} a week`}</Text>}
                </>
              )}
            </View>
            <ChevronRight size={20} color={colors.textMuted} />
          </View>
        </Card>
      )}
    </Pressable>
  );
}
