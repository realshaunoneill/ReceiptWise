import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, Landmark } from 'lucide-react-native';
import { type WirePlan } from '@shared/api/plan';
import { formatCents } from '@shared/currency';
import { useTheme } from '../contexts/ThemeContext';
import { radius, space } from '../theme';
import Button from '../ui/Button';
import { Card, Section } from '../ui/Section';
import Text from '../ui/Text';
import { shortDay } from './days';

/**
 * The second view, for the period that contains today: from what's actually in the bank, what's
 * left until payday once everything still to go has gone. Balances are typed in.
 */
export default function BankCheck({ plan }: { plan: WirePlan }) {
  const router = useRouter();
  const { colors } = useTheme();
  if (plan.daysLeft === null) return null;
  const view = plan.balance;
  const update = () => router.push({ pathname: '/sheets/plan-balances', params: { currency: plan.currency } });

  if (!view) {
    return (
      <Section>
        <Pressable
          onPress={update}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: pressed ? colors.cardPressed : 'transparent' })}
        >
          <Landmark size={20} color={colors.textSecondary} />
          <Text variant="callout" ink="secondary" style={{ flex: 1 }}>Check it against your bank: add today's balance to see what's actually left until payday.</Text>
        </Pressable>
      </Section>
    );
  }

  const short = view.availableCents < 0;
  const days = `${view.daysLeft} day${view.daysLeft === 1 ? '' : 's'} left`;
  const split = short || view.perWeekCents === null || view.perDayCents === null
    ? `More goes out than is there · ${days}`
    : `${formatCents(view.perWeekCents, plan.currency)} a week · ${formatCents(view.perDayCents, plan.currency)} a day · ${days}`;

  return (
    <Section>
      <Card padded>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Landmark size={15} color={colors.textMuted} />
              <Text variant="footnote" ink="muted">{short ? 'Short before payday' : 'Left until payday'}</Text>
            </View>
            <Text variant="title" ink={short ? 'bad' : 'primary'} tabular>{formatCents(Math.abs(view.availableCents), plan.currency)}</Text>
            <Text variant="footnote" ink="muted" tabular>{split}</Text>
          </View>
          <Button label="Update" variant="secondary" size="sm" onPress={update} />
        </View>
        <View style={{ marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderColor: colors.separator, gap: 6 }}>
          {view.accounts.map((account) => (
            <View key={account.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              {account.stale && <AlertTriangle size={14} color={colors.warn} accessibilityLabel="Out of date" />}
              <Text variant="footnote" ink={account.stale ? 'warn' : 'secondary'} style={{ flex: 1 }} numberOfLines={1}>{`${account.name} (${shortDay(account.asOfDate)})`}</Text>
              <Text variant="footnote" tabular>{formatCents(account.balanceCents, plan.currency)}</Text>
            </View>
          ))}
          <Text variant="caption" ink="muted" tabular>
            {`${view.incomingCents > 0 ? `+ ${formatCents(view.incomingCents, plan.currency)} still to come in · ` : ''}− ${formatCents(view.outgoingCents, plan.currency)} still to go out`}
          </Text>
          {plan.flags.includes('stale_balance') && <Text variant="caption" ink="warn">A balance is over a week old or from before this period: update it for a true figure.</Text>}
        </View>
      </Card>
    </Section>
  );
}
