import React from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChartLine, ReceiptText } from 'lucide-react-native';
import CaptureButton from '../../../src/components/CaptureButton';
import PlanCard from '../../../src/components/PlanCard';
import ReceiptRow from '../../../src/components/ReceiptRow';
import ScopePicker from '../../../src/components/ScopePicker';
import UpcomingPayments from '../../../src/components/UpcomingPayments';
import UploadStatus from '../../../src/components/UploadStatus';
import { useBills } from '../../../src/hooks/useBills';
import { useHouseholds } from '../../../src/hooks/useHouseholds';
import { useReceiptStats } from '../../../src/hooks/useInsights';
import { useMe } from '../../../src/hooks/useMe';
import { usePlan } from '../../../src/hooks/usePlan';
import { useReceipts } from '../../../src/hooks/useReceipts';
import QuickStats from '../../../src/insights/QuickStats';
import SpendingSummary from '../../../src/insights/SpendingSummary';
import { useScope } from '../../../src/scope';
import { GUTTER, space } from '../../../src/theme';
import Button from '../../../src/ui/Button';
import { EmptyState, LoadError, Notice } from '../../../src/ui/Feedback';
import Row from '../../../src/ui/Row';
import { List, Section } from '../../../src/ui/Section';
import TabScreen from '../../../src/ui/TabScreen';

/**
 * Where the money went and what's coming (the website's dashboard): this period's plan, the totals
 * and trend, the next week's payments, and the latest receipts. Whose: your own (every receipt you
 * added) or a household's, the same choice as the Plan's.
 */
export default function Home() {
  const router = useRouter();
  const me = useMe();
  const { householdId } = useScope();
  const households = useHouseholds();
  const premium = !!me.data?.subscribed;
  const entitlements = me.data?.entitlements;
  const financeAccess = premium || (entitlements?.householdIds.length ?? 0) > 0;
  // A member without Premium of their own, in a household someone else pays for, sees that
  // household's plan and bills: their own are empty (the website's dashboard does the same).
  const financeHousehold = householdId ?? (entitlements && !entitlements.personal ? entitlements.householdIds[0] : undefined);
  const plan = usePlan(0, financeHousehold);
  const bills = useBills('active', financeHousehold);
  const stats = useReceiptStats(householdId);
  const recent = useReceipts({ sortBy: 'created', householdId });
  const receipts = recent.data?.pages[0]?.receipts.slice(0, 5) ?? [];
  const currency = me.data?.currency ?? 'EUR';
  const household = householdId ? households.data?.find((candidate) => candidate.id === householdId) : undefined;
  const hasReceipts = (stats.data?.totalReceipts ?? 0) > 0;

  const refresh = () => {
    void me.refetch();
    void plan.refetch();
    void stats.refetch();
    void bills.refetch();
    void recent.refetch();
  };

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <CaptureButton /> }} />
      <TabScreen onRefresh={refresh} refreshing={recent.isRefetching && !recent.isFetchingNextPage}>
        <View style={{ marginHorizontal: GUTTER, marginBottom: space.lg }}>
          <ScopePicker />
        </View>
        {me.data && !financeAccess && (
          <Notice tone="neutral" title="Premium isn't on this account yet" style={{ marginHorizontal: GUTTER, marginBottom: space.xxl }}>
            Premium is what reads your receipts and keeps your monthly plan. Until it's on, you can see what's already here.
          </Notice>
        )}
        <UploadStatus />

        {financeAccess && (
          <Section title="Your month">
            <PlanCard plan={plan.data} loading={plan.isPending} />
          </Section>
        )}

        {stats.isError && !stats.data && (
          <LoadError message="Your receipts are safe; this is a problem fetching the totals." onRetry={() => void stats.refetch()} />
        )}

        {premium && hasReceipts && stats.data && (
          <>
            <Section title="At a glance">
              <QuickStats stats={stats.data} currency={currency} />
            </Section>
            <Section title="Spending">
              <SpendingSummary householdId={householdId} currency={currency} />
            </Section>
          </>
        )}

        <UpcomingPayments bills={bills.data ?? []} currency={currency} />

        {premium && hasReceipts && (
          <Section>
            <List>
              <Row icon={ChartLine} label="Insights" detail="A written summary, what you buy most, and any item's history" onPress={() => router.push('/insights')} />
            </List>
          </Section>
        )}

        <Section
          title="Recently added"
          accessory={receipts.length > 0 ? <Button label="See all" variant="plain" size="sm" onPress={() => router.navigate('/receipts')} /> : undefined}
        >
          {recent.isSuccess && receipts.length === 0 ? (
            household ? (
              <EmptyState
                icon={ReceiptText}
                title={`Nothing shared with ${household.name} yet`}
                body="Receipts appear here once someone shares one with the household, from its detail or as it's added."
              />
            ) : (
              <EmptyState
                icon={ReceiptText}
                title="No receipts yet"
                body="Photograph a receipt and it's read for you: the shop, the items and the total."
                action={premium ? { label: 'Add a receipt', onPress: () => router.push('/capture') } : undefined}
              />
            )
          ) : (
            <List inset={72}>
              {receipts.map((receipt) => <ReceiptRow key={receipt.id} receipt={receipt} />)}
            </List>
          )}
        </Section>
      </TabScreen>
    </>
  );
}
