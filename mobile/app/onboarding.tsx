import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import * as Localization from 'expo-localization';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, Check, ScanLine, Users, type LucideIcon } from 'lucide-react-native';
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '@shared/currency';
import { setConsent, useConsent } from '../src/analytics';
import { useTheme } from '../src/contexts/ThemeContext';
import { useCompleteOnboarding } from '../src/hooks/useAccount';
import { useMe, useUpdateCurrency } from '../src/hooks/useMe';
import { purchasesAvailable } from '../src/purchases';
import { GUTTER, radius, space } from '../src/theme';
import Button, { selectionTick, success } from '../src/ui/Button';
import { Notice } from '../src/ui/Feedback';
import { SwitchField } from '../src/ui/Form';
import { List } from '../src/ui/Section';
import Text from '../src/ui/Text';

/**
 * The first run, as the website's tour does it (components/onboarding/onboarding-tour.tsx): what
 * ReceiptWise does, then the currency every total is shown in, then done. Finishing records it on
 * the account (PATCH /api/users/onboarding), so neither the website nor the app shows it again.
 */

/** The account's currency if it was ever changed, else the phone's own if it's one we support. */
function startingCurrency(accountCurrency: string | undefined): string {
  if (accountCurrency && accountCurrency !== DEFAULT_CURRENCY) return accountCurrency;
  const phone = Localization.getLocales()[0]?.currencyCode;
  return SUPPORTED_CURRENCIES.some((c) => c.code === phone) ? phone! : DEFAULT_CURRENCY;
}

export default function Onboarding() {
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const me = useMe();
  const consent = useConsent();
  const currency = useUpdateCurrency();
  const complete = useCompleteOnboarding();
  const [step, setStep] = useState<'welcome' | 'setup'>('welcome');
  const [chosen, setChosen] = useState(() => startingCurrency(me.data?.currency));
  const touched = useRef(false);

  // The account may arrive after the first frame; until a choice is made, start from it.
  useEffect(() => {
    if (me.data && !touched.current) setChosen(startingCurrency(me.data.currency));
  }, [me.data]);

  const finish = async () => {
    try {
      if (me.data && chosen !== me.data.currency) await currency.mutateAsync(chosen);
      await complete.mutateAsync();
      success();
      navigation.goBack();
      // Nothing works without Premium: someone with none of their own (and no household paying)
      // is shown it next, where it can be bought.
      const entitled = !!me.data?.subscribed || (me.data?.entitlements.householdIds.length ?? 0) > 0;
      if (!entitled && purchasesAvailable) router.push('/paywall');
    } catch {
      // Shown below; they can try again.
    }
  };

  const error = currency.error ?? complete.error;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.lg }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: GUTTER, gap: space.lg, paddingBottom: space.xxl }}>
        {step === 'welcome' ? (
          <>
            <Text variant="largeTitle" accessibilityRole="header">Welcome to ReceiptWise</Text>
            <Text variant="body" ink="secondary">Your receipts, your bills and your month, in one place, and shared with your household if you like.</Text>
            <View style={{ gap: space.lg, marginTop: space.md }}>
              <Point icon={ScanLine} title="Receipts, read for you" body="Photograph one, or forward it by email: the shop, the date, every item and the total." />
              <Point icon={CalendarDays} title="Your month, planned" body="From one payday to the next: the bills on the way, and what's left for each week." />
              <Point icon={Users} title="Shared with your household" body="A partner, the family or housemates see the same receipts, bills and plan." />
            </View>
          </>
        ) : (
          <>
            <Text variant="largeTitle" accessibilityRole="header">Pick your currency</Text>
            <Text variant="body" ink="secondary">Every total in the app is shown in it. Receipts keep their own. You can change it later in Settings.</Text>
            <List inset={space.lg}>
              {SUPPORTED_CURRENCIES.map((option) => {
                const selected = option.code === chosen;
                return (
                  <Pressable
                    key={option.code}
                    onPress={() => {
                      selectionTick();
                      touched.current = true;
                      setChosen(option.code);
                    }}
                    accessibilityRole="radio"
                    aria-checked={selected}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingHorizontal: space.lg, gap: space.md, backgroundColor: pressed ? colors.cardPressed : 'transparent' })}
                  >
                    <Text variant="callout" style={{ flex: 1 }}>{`${option.name} (${option.symbol})`}</Text>
                    {selected && <Check size={20} color={colors.accent} strokeWidth={2.4} />}
                  </Pressable>
                );
              })}
            </List>
            <SwitchField
              label="Share usage analytics"
              detail="Which features are used, so we know what to improve. Never what's on your receipts."
              value={consent === 'granted'}
              onChange={(on) => setConsent(on ? 'granted' : 'denied')}
            />
            {!!error && <Notice tone="bad" title="That didn't save">{error.message}</Notice>}
          </>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: GUTTER, gap: space.sm }}>
        {step === 'welcome' ? (
          <Button label="Continue" onPress={() => setStep('setup')} />
        ) : (
          <>
            <Button label="Get started" haptic loading={currency.isPending || complete.isPending} onPress={() => void finish()} />
            <Button label="Back" variant="plain" onPress={() => setStep('welcome')} style={{ alignSelf: 'center' }} />
          </>
        )}
      </View>
    </View>
  );
}

function Point({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space.lg }}>
      <View style={{ width: 44, height: 44, borderRadius: radius.lg, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={22} color={colors.accent} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">{title}</Text>
        <Text variant="callout" ink="secondary">{body}</Text>
      </View>
    </View>
  );
}
