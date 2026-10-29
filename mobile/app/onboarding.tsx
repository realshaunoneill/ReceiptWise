import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import * as Localization from 'expo-localization';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, Check, ScanLine, Users, type LucideIcon } from 'lucide-react-native';
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '@shared/currency';
import { setConsent, useConsent } from '../src/analytics';
import { useTheme } from '../src/contexts/ThemeContext';
import { useCompleteOnboarding } from '../src/hooks/useAccount';
import { useMe, useUpdateCurrency } from '../src/hooks/useMe';
import { usePlan } from '../src/hooks/usePlan';
import PlanSetup from '../src/plan/PlanSetup';
import { purchasesAvailable } from '../src/purchases';
import { GUTTER, radius, readableColumn, space } from '../src/theme';
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
  const [step, setStep] = useState<'welcome' | 'setup' | 'plan'>('welcome');
  // Someone with Premium and no pay yet sets up the plan next (src/plan/PlanSetup.tsx).
  const entitled = !!me.data?.subscribed || (me.data?.entitlements.householdIds.length ?? 0) > 0;
  const plan = usePlan(0, undefined, entitled && !!me.data?.features.bills);
  const needsPlan = entitled && !!plan.data && !plan.data.primaryIncome && plan.data.viewerIncomeCount === 0;
  const [chosen, setChosen] = useState(() => startingCurrency(me.data?.currency));
  const touched = useRef(false);

  // The account may arrive after the first frame; until a choice is made, start from it.
  useEffect(() => {
    if (me.data && !touched.current) setChosen(startingCurrency(me.data.currency));
  }, [me.data]);

  const saveCurrency = async () => {
    if (me.data && chosen !== me.data.currency) await currency.mutateAsync(chosen);
  };

  /** After the currency: the plan's setup, if there's one to do, else done. */
  const next = async () => {
    if (!needsPlan) return finish();
    try {
      await saveCurrency();
      setStep('plan');
    } catch {
      // Shown below; they can try again.
    }
  };

  const finish = async (then?: '/plan') => {
    try {
      await saveCurrency();
      await complete.mutateAsync();
      success();
      navigation.goBack();
      if (then) router.navigate(then);
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ ...readableColumn, paddingHorizontal: GUTTER, gap: space.lg, paddingBottom: space.xxl }}>
        {step === 'plan' ? (
          <PlanSetup currency={chosen} onDone={() => void finish('/plan')} onSkip={() => void finish()} />
        ) : step === 'welcome' ? (
          <>
            <Text variant="largeTitle" accessibilityRole="header">Welcome to ReceiptWise</Text>
            {/* The plan leads, as on the website (2026-10-29). No "housemates": there's no splitting. */}
            <Text variant="body" ink="secondary">Know what's left until payday: your pay, your bills and your spending in one plan, and shared with your household if you like.</Text>
            <View style={{ gap: space.lg, marginTop: space.md }}>
              <Point icon={CalendarDays} title="Your month, planned" body="From one payday to the next: what comes in, the bills that go out, and what's left each week." />
              <Point icon={ScanLine} title="Receipts and bills, read for you" body="Photograph a receipt, or forward a bill by email: the shop, every item and the total, or the bill and its amount." />
              <Point icon={Users} title="Planned together" body="A partner or the family see the same plan, bills and receipts. One Premium covers the plan and bills you share." />
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
            {/* Its own heading: it sat under "Pick your currency" as if it were part of it. */}
            <Text variant="label" accessibilityRole="header" style={{ marginTop: space.md }}>Help us improve it</Text>
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
      </KeyboardAvoidingView>
      <View style={{ paddingHorizontal: GUTTER, gap: space.sm, display: step === 'plan' ? 'none' : 'flex' }}>
        {step === 'welcome' ? (
          <Button label="Continue" onPress={() => setStep('setup')} />
        ) : (
          <>
            <Button label={needsPlan ? 'Continue' : 'Get started'} haptic loading={currency.isPending || complete.isPending} onPress={() => void next()} />
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
