import React from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { type WireReceipt } from '@shared/api/receipts';
import { formatCurrency } from '@shared/currency';
import { daysBetween, localToday } from '@shared/dates/local-date';
import { categoryName, formatDisplayDate, receiptDay } from '@shared/receipts/format';
import { useTheme } from '../contexts/ThemeContext';
import { isBeingRead } from '../hooks/useReceipts';
import { radius, space } from '../theme';
import Amount from '../ui/Amount';
import { Pill } from '../ui/Feedback';
import Text from '../ui/Text';
import { CategoryIcon } from './CategoryIcon';

/**
 * "Added today", "Added yesterday", "Added 3 days ago" within the week, else null: after that the
 * receipt's own day says more (a stack imported on one day would all read "Added 20 Jan").
 */
export function addedLabel(createdAt: string, today = localToday()): string | null {
  const ago = daysBetween(localToday(new Date(createdAt)), today);
  if (ago <= 0) return 'Added today';
  if (ago === 1) return 'Added yesterday';
  if (ago < 7) return `Added ${ago} days ago`;
  return null;
}

type Props = {
  receipt: WireReceipt;
  /**
   * What the line under the shop says besides the category: the receipt's day (the default), when
   * it was added this week (a list in the order they came in; older ones show their day), or
   * nothing (under a day's heading, which already says the day).
   */
  when?: 'day' | 'added' | 'none';
};

/** One receipt in a list: its photo, the shop, the day and category, the total, and its state. */
export default function ReceiptRow({ receipt, when = 'day' }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const day = receiptDay(receipt);
  const failed = receipt.processingStatus === 'failed';
  const reading = isBeingRead(receipt);
  const notReceipt = receipt.isReceipt === false;
  const total = receipt.totalAmount ? Number(receipt.totalAmount) : null;
  const title = reading ? 'Reading…' : receipt.merchantName || (failed ? "Couldn't read this one" : 'Receipt');
  const dayText = day ? formatDisplayDate(day, { day: 'numeric', month: 'short' }) : null;
  const whenText = when === 'added' ? addedLabel(receipt.createdAt) ?? dayText : when === 'day' ? dayText : null;
  const detail = [whenText, receipt.category ? categoryName(receipt.category) : null].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={() => router.push(`/receipts/${receipt.id}`)}
      accessibilityRole="button"
      // The total with its currency ("€6.51"): it was read out as a bare "6.51".
      accessibilityLabel={[title, total !== null && !reading ? formatCurrency(total, receipt.currency ?? undefined) : null, day ? formatDisplayDate(day) : null].filter(Boolean).join(', ')}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, backgroundColor: pressed ? colors.cardPressed : 'transparent' })}
    >
      <View style={{ width: 48, height: 48, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center' }}>
        {receipt.imageUrl
          ? <Image source={{ uri: receipt.imageUrl }} style={{ width: 48, height: 48 }} contentFit="cover" transition={150} />
          : <CategoryIcon category={receipt.category} size={22} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="semibold" numberOfLines={1}>{title}</Text>
        {!!detail && <Text variant="footnote" ink="muted" numberOfLines={1}>{detail}</Text>}
        {/* Still being read says so in the title; only a problem gets a pill. */}
        {(failed || notReceipt) && (
          <View style={{ marginTop: 2 }}>
            <Pill label={failed ? "Couldn't read" : 'Not a receipt'} tone={failed ? 'bad' : 'warn'} />
          </View>
        )}
      </View>
      {total !== null && !reading && <Amount value={total} currency={receipt.currency} />}
    </Pressable>
  );
}
