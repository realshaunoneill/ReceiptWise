import React, { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from 'expo-router';
import { Check, Home as HouseIcon, LineChart, ReceiptText, ScanLine } from 'lucide-react-native';
import { SITE_URL } from '../src/config';
import { useTheme } from '../src/contexts/ThemeContext';
import { useMe } from '../src/hooks/useMe';
import { purchasesAvailable } from '../src/purchases';
import { priceLine, renewalTerms } from '../src/purchases/terms';
import { isCancelled, useOfferings, usePurchase, useRestore, useTrialEligibility, type PremiumPackage } from '../src/purchases/usePurchases';
import { radius, space } from '../src/theme';
import Button, { selectionTick, success } from '../src/ui/Button';
import { Notice, Skeleton } from '../src/ui/Feedback';
import SheetScreen from '../src/ui/Sheet';
import Text from '../src/ui/Text';

// The plan first, as on the website. Sharing says what one Premium covers (the plan and bills shared
// with a household); receipts still need your own, so nothing here says otherwise.
const POINTS = [
  { icon: ReceiptText, title: 'Your month, planned', body: 'What’s left until payday, from your pay and your bills, with the bills read off the PDFs.' },
  { icon: ScanLine, title: 'Receipts, read for you', body: 'Photograph one, or forward it by email: the shop, every item and the total.' },
  { icon: HouseIcon, title: 'Planned together', body: 'One Premium covers the plan and bills you share with your household.' },
  { icon: LineChart, title: 'Where the money goes', body: 'A written summary, what you buy most, and any item’s history.' },
];

/**
 * Premium, bought in the app (App Store or Google Play through RevenueCat). Prices come only from
 * the store (getOfferings), never from here; the small print is what App Store guideline 3.1.2
 * asks for. Where purchases can't work (no key yet, an older build, the web preview) it says so
 * instead of showing a paywall that can't take money.
 */
export default function Paywall() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const me = useMe();
  const offerings = useOfferings();
  const trial = useTrialEligibility(offerings.data);
  const purchase = usePurchase();
  const restore = useRestore();
  const [selected, setSelected] = useState<string | null>(null);
  const packages = offerings.data ?? [];
  const chosen = packages.find((pkg) => pkg.identifier === selected) ?? packages[0];
  const eligible = !!chosen && !!trial.data?.[chosen.product.identifier];
  const error = [purchase.error, restore.error].find((e) => e && !isCancelled(e));

  // Bought (or restored), and the website has seen it: done.
  useEffect(() => {
    if (me.data?.premium?.active && me.data.premium.source !== 'stripe' && (purchase.isSuccess || restore.isSuccess)) {
      success();
      navigation.goBack();
    }
  }, [me.data?.premium, purchase.isSuccess, restore.isSuccess, navigation]);

  const open = (path: string) => void WebBrowser.openBrowserAsync(`${SITE_URL}${path}`);

  if (me.data?.premium?.active) {
    return (
      <SheetScreen title="Premium" closeLabel="Done" fullScreen>
        <Notice tone="good" title="This account has Premium">Everything ReceiptWise does is on.</Notice>
      </SheetScreen>
    );
  }

  if (!purchasesAvailable) {
    return (
      <SheetScreen title="Premium" closeLabel="Done" fullScreen>
        <Notice tone="neutral" title="Premium isn't on this account yet">
          It can't be bought in this version of the app. When it can, it will be here.
        </Notice>
      </SheetScreen>
    );
  }

  const yearly = packages.find((pkg) => pkg.packageType === 'ANNUAL');
  const monthly = packages.find((pkg) => pkg.packageType === 'MONTHLY');
  const saving = yearly && monthly && monthly.product.price > 0 ? Math.round((1 - yearly.product.price / (monthly.product.price * 12)) * 100) : 0;

  return (
    <SheetScreen title="Premium" closeLabel="Not now" fullScreen>
      <View style={{ gap: space.xs, marginTop: space.sm }}>
        <Text variant="largeTitle" accessibilityRole="header">ReceiptWise Premium</Text>
        <Text variant="callout" ink="secondary">One plan, everything included.</Text>
      </View>

      <View style={{ gap: space.md }}>
        {POINTS.map(({ icon: Icon, title, body }) => (
          <View key={title} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
            <Icon size={20} color={colors.accent} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label">{title}</Text>
              <Text variant="footnote" ink="muted">{body}</Text>
            </View>
          </View>
        ))}
      </View>

      {offerings.isPending ? (
        <View style={{ gap: space.md }}>
          <Skeleton height={72} round={radius.lg} />
          <Skeleton height={72} round={radius.lg} />
        </View>
      ) : packages.length === 0 ? (
        <Notice tone="warn" title="Couldn't load the prices">
          {offerings.error ? 'Check your connection and try again.' : "Premium isn't available in this store yet."}
        </Notice>
      ) : (
        <View style={{ gap: space.md }} accessibilityRole="radiogroup">
          {packages.map((pkg) => (
            <Option
              key={pkg.identifier}
              pkg={pkg}
              selected={pkg.identifier === chosen?.identifier}
              trial={!!trial.data?.[pkg.product.identifier]}
              badge={pkg === yearly && saving > 0 ? `Save ${saving}%` : null}
              onPress={() => {
                selectionTick();
                setSelected(pkg.identifier);
              }}
            />
          ))}
        </View>
      )}

      {!!chosen && (
        <View style={{ gap: space.md }}>
          <Button
            label={eligible ? 'Start the free trial' : 'Subscribe'}
            haptic
            loading={purchase.isPending}
            disabled={restore.isPending}
            onPress={() => purchase.mutate(chosen)}
          />
          <Text variant="footnote" ink="muted" align="center">{priceLine(chosen.product, eligible)}</Text>
        </View>
      )}

      {!!error && <Notice tone="bad" title="That didn't work">{error.message || 'The store refused the payment. Nothing was charged.'}</Notice>}

      <Text variant="caption" ink="muted">{renewalTerms(Platform.OS === 'android' ? 'android' : 'ios')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.lg }}>
        <Button label="Restore purchases" variant="plain" size="sm" loading={restore.isPending} disabled={purchase.isPending} onPress={() => restore.mutate()} />
        <Button label="Terms" variant="plain" size="sm" onPress={() => open('/terms')} />
        <Button label="Privacy" variant="plain" size="sm" onPress={() => open('/privacy')} />
      </View>
    </SheetScreen>
  );
}

function Option({ pkg, selected, trial, badge, onPress }: { pkg: PremiumPackage; selected: boolean; trial: boolean; badge: string | null; onPress: () => void }) {
  const { colors } = useTheme();
  const name = pkg.packageType === 'ANNUAL' ? 'Yearly' : pkg.packageType === 'MONTHLY' ? 'Monthly' : pkg.product.title;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={selected}
      accessibilityLabel={`${name}, ${priceLine(pkg.product, trial)}`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.xl,
        borderWidth: selected ? 2 : 1, borderColor: selected ? colors.accent : colors.border,
        backgroundColor: pressed ? colors.cardPressed : colors.card,
      })}
    >
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: selected ? 0 : 2, borderColor: colors.textMuted, backgroundColor: selected ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {selected && <Check size={14} color={colors.onAccent} strokeWidth={3} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text variant="label">{name}</Text>
          {!!badge && (
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.accentSoft }}>
              <Text variant="caption" ink="accent">{badge}</Text>
            </View>
          )}
        </View>
        <Text variant="footnote" ink="muted" tabular>{priceLine(pkg.product, trial)}</Text>
      </View>
    </Pressable>
  );
}
