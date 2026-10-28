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
 * This period at a glance: what's left after everything planned, the weekly split, and what's in
 * the bank until payday if a balance was given (the website's dashboard card, in the same words).
 * The plan's figure and the account's are named apart, so "€2,539 left in the plan" and "your
 * account is €289 short" don't read as a contradiction. A shortfall says "over" (DESIGN.md).
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
  const money = (cents: number) => formatCents(Math.abs(cents), plan.currency);
  const balance = plan.balance;
  const below = [
    !over ? `${money(weeklyCents)} a week` : null,
    balance ? (balance.availableCents < 0
      ? `your account is ${money(balance.availableCents)} short before payday`
      : `${money(balance.availableCents)} left in your account until payday`) : null,
  ].filter(Boolean).join(' · ');

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
                    {`${money(remainingCents)} ${over ? 'over in the plan' : 'left in the plan'}`}
                  </Text>
                  {!!below && <Text variant="footnote" ink="secondary" tabular>{below}</Text>}
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
