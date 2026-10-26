import React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { Briefcase, Mail, RotateCcw, Trash2, Users } from 'lucide-react-native';
import { categoryName, formatDisplayDate, formatPaymentMethod, receiptDay } from '@shared/receipts/format';
import { CategoryIcon } from '../../../src/components/CategoryIcon';
import { SUPPORT_EMAIL } from '../../../src/config';
import { choose, confirm } from '../../../src/confirm';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { useHouseholds } from '../../../src/hooks/useHouseholds';
import { useMe } from '../../../src/hooks/useMe';
import { isBeingRead, useAssignReceipt, useDeleteReceipt, useReceipt, useRetryReceipt, useSetBusinessExpense } from '../../../src/hooks/useReceipts';
import { GUTTER, radius, space } from '../../../src/theme';
import Amount from '../../../src/ui/Amount';
import { selectionTick, success } from '../../../src/ui/Button';
import { LoadError, Notice, Pill, Skeleton } from '../../../src/ui/Feedback';
import Row from '../../../src/ui/Row';
import { List, Section } from '../../../src/ui/Section';
import TabScreen from '../../../src/ui/TabScreen';
import Text from '../../../src/ui/Text';

/** One receipt: the photo, what was read off it, and what can be done with it. */
export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const me = useMe();
  const households = useHouseholds();
  const query = useReceipt(id);
  const retry = useRetryReceipt(id);
  const remove = useDeleteReceipt(id);
  const assign = useAssignReceipt(id);
  const business = useSetBusinessExpense(id);

  const receipt = query.data;
  if (!receipt) {
    return (
      <TabScreen>
        {query.isError ? <LoadError message={query.error.message} onRetry={() => void query.refetch()} /> : (
          <View style={{ marginHorizontal: GUTTER, gap: space.lg }}>
            <Skeleton height={240} round={radius.lg} />
            <Skeleton width="60%" height={24} />
            <Skeleton width="40%" />
          </View>
        )}
      </TabScreen>
    );
  }

  const isOwner = receipt.userId === me.data?.id;
  const day = receiptDay(receipt);
  const reading = isBeingRead(receipt);
  const failed = receipt.processingStatus === 'failed';
  const total = receipt.totalAmount ? Number(receipt.totalAmount) : null;
  const household = households.data?.find((h) => h.id === receipt.householdId);
  const money = (value: string | null) => (value && !Number.isNaN(Number(value)) ? Number(value) : null);
  const subtotal = money(receipt.subtotal);
  const tax = money(receipt.tax);
  const serviceCharge = money(receipt.serviceCharge);

  const share = async () => {
    const options = [{ id: null as string | null, label: 'Just me' }, ...(households.data ?? []).map((h) => ({ id: h.id, label: h.name }))];
    const index = await choose('Who can see this receipt?', options.map((o) => ({ label: o.id === receipt.householdId ? `${o.label} ✓` : o.label })));
    if (index === null || options[index].id === receipt.householdId) return;
    assign.mutate(options[index].id, { onSuccess: success });
  };

  const del = async () => {
    if (!(await confirm('Delete this receipt?', "It's removed from your receipts and totals, and deleted for good after 30 days.", 'Delete'))) return;
    remove.mutate(undefined, { onSuccess: () => navigation.goBack() });
  };

  return (
    <>
      <Stack.Screen options={{ title: receipt.merchantName ?? 'Receipt' }} />
      <TabScreen onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
        <View style={{ marginHorizontal: GUTTER, marginBottom: space.xl, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.field }}>
          <Image source={{ uri: receipt.imageUrl }} style={{ width: '100%', aspectRatio: 3 / 4 }} contentFit="contain" transition={150} accessibilityLabel="The receipt's photo" />
        </View>

        <View style={{ marginHorizontal: GUTTER + space.xs, marginBottom: space.xl, gap: space.sm }}>
          <Text variant="title" accessibilityRole="header">{reading ? 'Being read…' : receipt.merchantName || (failed ? "Couldn't read this one" : 'Receipt')}</Text>
          {total !== null && !reading && <Amount value={total} currency={receipt.currency} variant="largeTitle" weight="bold" />}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
            {!!receipt.category && <CategoryIcon category={receipt.category} size={16} />}
            <Text variant="callout" ink="secondary">
              {[day ? formatDisplayDate(day) : null, receipt.category ? categoryName(receipt.category) : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            {reading && <Pill label="Being read" tone="warn" />}
            {failed && <Pill label="Couldn't read" tone="bad" />}
            {receipt.isReceipt === false && <Pill label="Not a receipt" tone="warn" />}
            {!!household && <Pill label={`Shared with ${household.name}`} tone="neutral" />}
            {receipt.isBusinessExpense && <Pill label="Business" tone="neutral" />}
          </View>
        </View>

        {failed && (
          <Section>
            <Notice tone="bad" title="This one couldn't be read">{receipt.processingError || 'Try reading it again, or take a clearer photo.'}</Notice>
          </Section>
        )}

        {!!receipt.items?.length && (
          <Section title={receipt.items.length === 1 ? '1 item' : `${receipt.items.length} items`}>
            <List>
              {receipt.items.map((item) => {
                const price = money(item.totalPrice ?? item.price);
                const quantity = item.quantity && item.quantity !== '1' ? `${item.quantity} × ` : '';
                return (
                  <Row
                    key={item.id}
                    label={`${quantity}${item.name}`}
                    value={price !== null ? <Amount value={price} currency={receipt.currency} weight="regular" /> : undefined}
                  />
                );
              })}
            </List>
          </Section>
        )}

        {(subtotal !== null || tax !== null || serviceCharge !== null || !!receipt.paymentMethod || !!receipt.receiptNumber) && (
          <Section title="Details">
            <List>
              {subtotal !== null && <Row label="Subtotal" value={<Amount value={subtotal} currency={receipt.currency} weight="regular" />} />}
              {tax !== null && <Row label="VAT (included)" value={<Amount value={tax} currency={receipt.currency} weight="regular" />} />}
              {serviceCharge !== null && <Row label="Service charge" value={<Amount value={serviceCharge} currency={receipt.currency} weight="regular" />} />}
              {!!receipt.paymentMethod && <Row label="Paid with" value={formatPaymentMethod(receipt.paymentMethod)} />}
              {!!receipt.location && <Row label="Where" value={receipt.location} />}
              {!!receipt.receiptNumber && <Row label="Receipt number" value={<Text variant="callout" weight="monoMedium" selectable>{receipt.receiptNumber}</Text>} />}
            </List>
          </Section>
        )}

        {isOwner && (
          <Section>
            <List>
              {(households.data?.length ?? 0) > 0 && (
                <Row icon={Users} label="Shared with" value={household?.name ?? 'Just me'} onPress={() => void share()} />
              )}
              <Pressable
                onPress={() => {
                  selectionTick();
                  business.mutate(!receipt.isBusinessExpense);
                }}
                accessibilityRole="switch"
                aria-checked={!!receipt.isBusinessExpense}
                aria-busy={business.isPending}
              >
                <Row icon={Briefcase} label="Business expense" value={(business.isPending ? business.variables : receipt.isBusinessExpense) ? 'Yes' : 'No'} />
              </Pressable>
              {failed && <Row icon={RotateCcw} label="Read it again" accent onPress={() => retry.mutate()} />}
              <Row
                icon={Mail}
                label="Report a problem"
                accent
                onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('A receipt was read wrongly')}&body=${encodeURIComponent(`Receipt ${receipt.id}\n\n`)}`)}
              />
              <Row icon={Trash2} label="Delete receipt" destructive onPress={() => void del()} />
            </List>
          </Section>
        )}
      </TabScreen>
    </>
  );
}
