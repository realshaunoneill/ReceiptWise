import React from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { type WireReceipt } from '@shared/api/receipts';
import { categoryName, formatDisplayDate, receiptDay } from '@shared/receipts/format';
import { useTheme } from '../contexts/ThemeContext';
import { isBeingRead } from '../hooks/useReceipts';
import { radius, space } from '../theme';
import Amount from '../ui/Amount';
import { Pill } from '../ui/Feedback';
import Text from '../ui/Text';
import { CategoryIcon } from './CategoryIcon';

/** One receipt in a list: its photo, the shop, the day and category, the total, and its state. */
export default function ReceiptRow({ receipt }: { receipt: WireReceipt }) {
  const { colors } = useTheme();
  const router = useRouter();
  const day = receiptDay(receipt);
  const failed = receipt.processingStatus === 'failed';
  const reading = isBeingRead(receipt);
  const notReceipt = receipt.isReceipt === false;
  const total = receipt.totalAmount ? Number(receipt.totalAmount) : null;
  const title = reading ? 'Being read…' : receipt.merchantName || (failed ? "Couldn't read this one" : 'Receipt');

  return (
    <Pressable
      onPress={() => router.push(`/receipts/${receipt.id}`)}
      accessibilityRole="button"
      accessibilityLabel={[title, total !== null ? `${total}` : null, day ? formatDisplayDate(day) : null].filter(Boolean).join(', ')}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, backgroundColor: pressed ? colors.cardPressed : 'transparent' })}
    >
      <View style={{ width: 48, height: 48, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center' }}>
        {receipt.imageUrl
          ? <Image source={{ uri: receipt.imageUrl }} style={{ width: 48, height: 48 }} contentFit="cover" transition={150} />
          : <CategoryIcon category={receipt.category} size={22} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="semibold" numberOfLines={1}>{title}</Text>
        <Text variant="footnote" ink="muted" numberOfLines={1}>
          {[day ? formatDisplayDate(day, { day: 'numeric', month: 'short' }) : null, receipt.category ? categoryName(receipt.category) : null].filter(Boolean).join(' · ')}
        </Text>
        {(failed || reading || notReceipt) && (
          <View style={{ marginTop: 2 }}>
            <Pill label={failed ? "Couldn't read" : reading ? 'Being read' : 'Not a receipt'} tone={failed ? 'bad' : 'warn'} />
          </View>
        )}
      </View>
      {total !== null && !reading && <Amount value={total} currency={receipt.currency} />}
    </Pressable>
  );
}

