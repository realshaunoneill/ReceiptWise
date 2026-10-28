import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, Landmark } from 'lucide-react-native';
import { type WirePlan } from '@shared/api/plan';
import { formatCents } from '@shared/currency';
import { bankCheckExplainer, bankCheckTitle } from '@shared/plan/bank-copy';
import { useTheme } from '../contexts/ThemeContext';
import { space } from '../theme';
import Button from '../ui/Button';
import { Card, Section } from '../ui/Section';
import Text from '../ui/Text';
import { shortDay } from './days';

/**
 * The second view, for the month that contains today: from what's actually in the bank, what's
 * left until payday once everything still to go has gone. Balances are typed in. It says where its
 * figure comes from (shared/plan/bank-copy.ts), so it doesn't read as contradicting the plan's
 * own "left", as on the website.
 */
export default function BankCheck({ plan }: { plan: WirePlan }) {
  const router = useRouter();
  const { colors } = useTheme();
  if (plan.daysLeft === null) return null;
  const view = plan.balance;
  const update = () => router.push({ pathname: '/sheets/plan-balances', params: { currency: plan.currency } });

  // Until a balance is added, it's one row at the bottom of the plan (app/(tabs)/plan/index.tsx).
  if (!view) return null;

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
              <Text variant="footnote" ink="muted">{bankCheckTitle(view)}</Text>
            </View>
            <Text variant="title" ink={short ? 'bad' : 'primary'} tabular>{formatCents(Math.abs(view.availableCents), plan.currency)}</Text>
            <Text variant="footnote" ink="muted" tabular>{split}</Text>
          </View>
          <Button label="Update" variant="secondary" size="sm" onPress={update} />
        </View>
        <View style={{ marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderColor: colors.separator, gap: 6 }}>
          <Text variant="footnote" ink="secondary" tabular>{bankCheckExplainer(view, plan.lines, plan.currency)}</Text>
          {/* One account is in the sentence above; several are listed. */}
          {view.accounts.length > 1 && view.accounts.map((account) => (
            <View key={account.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              {account.stale && <AlertTriangle size={14} color={colors.warn} accessibilityLabel="Out of date" />}
              <Text variant="footnote" ink={account.stale ? 'warn' : 'secondary'} style={{ flex: 1 }} numberOfLines={1}>{`${account.name} (${shortDay(account.asOfDate)})`}</Text>
              <Text variant="footnote" tabular>{formatCents(account.balanceCents, plan.currency)}</Text>
            </View>
          ))}
          {plan.flags.includes('stale_balance') && <Text variant="caption" ink="warn">A balance is over a week old or from before this month: update it for a true figure.</Text>}
        </View>
      </Card>
    </Section>
  );
}
