import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { ReceiptText } from 'lucide-react-native';
import CaptureButton from '../../../src/components/CaptureButton';
import PlanCard from '../../../src/components/PlanCard';
import ReceiptRow from '../../../src/components/ReceiptRow';
import UploadStatus from '../../../src/components/UploadStatus';
import { useMe } from '../../../src/hooks/useMe';
import { usePlan } from '../../../src/hooks/usePlan';
import { useReceipts } from '../../../src/hooks/useReceipts';
import Button from '../../../src/ui/Button';
import { EmptyState, Notice } from '../../../src/ui/Feedback';
import { List, Section } from '../../../src/ui/Section';
import TabScreen from '../../../src/ui/TabScreen';

export default function Home() {
  const router = useRouter();
  const me = useMe();
  const premium = !!me.data?.subscribed;
  const financeAccess = premium || (me.data?.entitlements.householdIds.length ?? 0) > 0;
  const plan = usePlan(0, undefined);
  const recent = useReceipts({ sortBy: 'created' });
  const receipts = recent.data?.pages[0]?.receipts.slice(0, 5) ?? [];

  const refresh = () => {
    void me.refetch();
    void plan.refetch();
    void recent.refetch();
  };

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <CaptureButton /> }} />
      <TabScreen onRefresh={refresh} refreshing={recent.isRefetching && !recent.isFetchingNextPage}>
        {me.data && !financeAccess && (
          <Notice tone="neutral" title="Premium isn't on this account yet" style={{ marginHorizontal: 16, marginBottom: 24 }}>
            Premium is what reads your receipts and keeps your monthly plan. Until it's on, you can see what's already here.
          </Notice>
        )}
        <UploadStatus />
        {financeAccess && (
          <Section title="Your month">
            <PlanCard plan={plan.data} loading={plan.isPending} />
          </Section>
        )}
        <Section
          title="Recently added"
          accessory={receipts.length > 0 ? <Button label="See all" variant="plain" size="sm" onPress={() => router.navigate('/receipts')} /> : undefined}
        >
          {recent.isSuccess && receipts.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="No receipts yet"
              body="Photograph a receipt and it's read for you: the shop, the items and the total."
              action={premium ? { label: 'Add a receipt', onPress: () => router.push('/capture') } : undefined}
            />
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
