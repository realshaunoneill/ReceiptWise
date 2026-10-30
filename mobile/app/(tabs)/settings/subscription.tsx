import React from 'react';
import { Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Crown, RotateCcw, Settings2 } from 'lucide-react-native';
import { premiumBilling } from '@shared/labels/premium';
import { useHouseholds } from '../../../src/hooks/useHouseholds';
import { useMe } from '../../../src/hooks/useMe';
import { purchasesAvailable, purchasesModule } from '../../../src/purchases';
import { isCancelled, useRestore } from '../../../src/purchases/usePurchases';
import Button from '../../../src/ui/Button';
import { Notice } from '../../../src/ui/Feedback';
import Row from '../../../src/ui/Row';
import { List, Section } from '../../../src/ui/Section';
import TabScreen from '../../../src/ui/TabScreen';

const PLAY_SUBSCRIPTIONS = 'https://play.google.com/store/account/subscriptions?package=io.receiptwise.app';

/**
 * Where this account's Premium comes from, in the website's words (shared/labels/premium.ts), and
 * how to manage it there. Premium paid on the website is named, not linked, and shows no price:
 * the App Store doesn't allow pointing to another way to pay (guideline 3.1.1).
 */
export default function Subscription() {
  const router = useRouter();
  const me = useMe();
  const households = useHouseholds();
  const restore = useRestore();
  const premium = me.data?.premium;
  const billing = premiumBilling(premium);
  const covering = !me.data?.subscribed
    ? (households.data ?? []).find((household) => me.data?.entitlements.householdIds.includes(household.id))?.name
    : undefined;

  const manage = async () => {
    if (premium?.source === 'play_store') return void Linking.openURL(PLAY_SUBSCRIPTIONS);
    // The App Store's own sheet; on an older build without purchases, its page.
    const module = purchasesModule();
    if (module) await module.default.showManageSubscriptions().catch(() => Linking.openURL('https://apps.apple.com/account/subscriptions'));
    else void Linking.openURL('https://apps.apple.com/account/subscriptions');
  };
  const managedHere = (premium?.source === 'app_store' && Platform.OS === 'ios') || (premium?.source === 'play_store' && Platform.OS === 'android');

  return (
    <TabScreen onRefresh={() => me.refetch()}>
      {billing ? (
        <Section title="Premium" footer={billing.manage ?? undefined}>
          <List>
            <Row icon={Crown} label={billing.title} detail={billing.detail ?? undefined} />
            {managedHere && <Row icon={Settings2} label={premium?.source === 'play_store' ? 'Manage on Google Play' : 'Manage subscription'} accent onPress={() => void manage()} />}
          </List>
        </Section>
      ) : (
        <Section>
          <Notice tone="neutral" title={covering ? `Covered by ${covering}'s Premium` : 'Not on Premium'}>
            {covering
              ? 'Its shared bills and plan are yours to use. One Premium covers up to six people, and that one already covers six, so reading receipts needs Premium of your own.'
              : 'Premium reads your receipts and bills, and keeps your monthly plan.'}
          </Notice>
          {purchasesAvailable && <Button label="See Premium" onPress={() => router.push('/paywall')} style={{ marginTop: 12 }} />}
        </Section>
      )}

      {purchasesAvailable && (
        <Section footer="Bought Premium in the app on another phone, or before reinstalling? Restore it here.">
          <List>
            <Row icon={RotateCcw} label={restore.isPending ? 'Restoring…' : 'Restore purchases'} accent onPress={() => restore.mutate()} />
          </List>
          {!!restore.error && !isCancelled(restore.error) && (
            <Notice tone="bad" title="Couldn't restore" style={{ marginTop: 12 }}>{restore.error.message}</Notice>
          )}
          {restore.isSuccess && !restore.data?.subscribed && (
            <Notice tone="neutral" title="Nothing to restore" style={{ marginTop: 12 }}>No Premium bought in the app was found for this store account.</Notice>
          )}
        </Section>
      )}
    </TabScreen>
  );
}
