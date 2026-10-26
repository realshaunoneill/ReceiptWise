import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Check } from 'lucide-react-native';
import { type WirePayment } from '@shared/api/bills';
import { type WireReceipt } from '@shared/api/receipts';
import { formatCurrency } from '@shared/currency';
import { daysBetween, formatLocalDate } from '@shared/dates/local-date';
import { fromCents, toCents } from '@shared/money';
import { receiptDay } from '@shared/receipts/format';
import { receiptMismatches, type ExpectedPayment, type ReceiptMismatch } from '@shared/subscriptions/receipt-match';
import { paymentDay } from '../../src/bills/summary';
import { CategoryIcon } from '../../src/components/CategoryIcon';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useBill, useLinkCandidates, useUpdatePayment } from '../../src/hooks/useBills';
import { radius, space } from '../../src/theme';
import { selectionTick, success } from '../../src/ui/Button';
import { Field } from '../../src/ui/Controls';
import { LoadError, Notice, Skeleton } from '../../src/ui/Feedback';
import { Card, List } from '../../src/ui/Section';
import SheetScreen from '../../src/ui/Sheet';
import Text from '../../src/ui/Text';

const shortDay = (day: string) => formatLocalDate(day, { day: 'numeric', month: 'short' }, 'en-IE');

function mismatchText(problem: ReceiptMismatch, name: string, currency: string): string {
  switch (problem.kind) {
    case 'currency':
      return `It's in ${problem.receiptCurrency}, not ${problem.expectedCurrency}.`;
    case 'amount':
      return `It's for ${formatCurrency(Number(fromCents(problem.receiptCents)), currency)}, not the ${formatCurrency(Number(fromCents(problem.expectedCents)), currency)} expected.`;
    case 'merchant':
      return `It's from ${problem.merchant}, which doesn't look like ${name}.`;
  }
}

/** A payment a receipt can still be linked to: not settled by one already, not skipped. */
const linkable = (payment: WirePayment) => !payment.receiptId && payment.status !== 'skipped' && payment.status !== 'cancelled';

/**
 * Link the receipt that paid one of a bill's payments, as the website's link-receipt dialog does.
 * Receipts from ten days either side of the payment are offered, the ones that fit (amount,
 * currency) first; a search looks through all of them. Linking marks the payment paid at the
 * receipt's amount, so a receipt that clearly doesn't fit says so before it's linked.
 */
export default function LinkReceipt() {
  const { billId, paymentId } = useLocalSearchParams<{ billId: string; paymentId?: string }>();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const bill = useBill(billId);
  const link = useUpdatePayment();
  const [chosenPayment, setChosenPayment] = useState<string | null>(paymentId ?? null);
  const [chosenReceipt, setChosenReceipt] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  // One request per pause in typing, not per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const payment = bill.data?.payments.find((p) => p.id === chosenPayment);
  const around = payment ? paymentDay(payment) : null;
  const candidates = useLinkCandidates(around, debounced);
  const name = bill.data?.name;
  const expectedAmount = payment?.expectedAmount;
  const expectedCurrency = bill.data?.currency;

  // The ones that fit first, then the nearest in date.
  const ranked = useMemo(() => {
    const receipts = candidates.data ?? [];
    if (!name || !expectedAmount || !expectedCurrency || !around) return receipts.map((receipt) => ({ receipt, problems: [] as ReceiptMismatch[] }));
    const expected: ExpectedPayment = { name, amount: expectedAmount, currency: expectedCurrency };
    const distance = (receipt: WireReceipt) => {
      const day = receiptDay(receipt);
      return day ? Math.abs(daysBetween(around, day)) : 999;
    };
    return receipts
      .map((receipt) => ({ receipt, problems: receiptMismatches(receipt, expected) }))
      .sort((a, b) => Number(a.problems.length > 0) - Number(b.problems.length > 0) || distance(a.receipt) - distance(b.receipt));
  }, [candidates.data, name, expectedAmount, expectedCurrency, around]);

  const selected = ranked.find((entry) => entry.receipt.id === chosenReceipt);

  if (!bill.data) {
    return (
      <SheetScreen title="Link a receipt">
        {bill.isError ? <LoadError message={bill.error.message} onRetry={() => void bill.refetch()} /> : <Skeleton height={200} round={radius.lg} />}
      </SheetScreen>
    );
  }

  const choices = bill.data.payments.filter(linkable);
  const currency = bill.data.currency;

  return (
    <SheetScreen
      title="Link a receipt"
      action={{
        label: 'Link',
        disabled: !payment || !chosenReceipt,
        loading: link.isPending,
        onPress: () => payment && chosenReceipt && link.mutate(
          { paymentId: payment.id, data: { receiptId: chosenReceipt } },
          {
            onSuccess: () => {
              success();
              navigation.goBack();
            },
          },
        ),
      }}
    >
      <Text variant="callout" ink="secondary">
        {`The receipt that paid ${bill.data.name}. The payment is marked paid at the receipt's amount.`}
      </Text>
      {link.isError && <Notice tone="bad" title="That didn't link">{link.error.message}</Notice>}

      {paymentId && payment ? (
        <Card padded>
          <Text variant="footnote" ink="muted">For the payment</Text>
          <Text variant="callout" weight="semibold" tabular>
            {`${shortDay(paymentDay(payment))} · ${formatCurrency((toCents(payment.expectedAmount) ?? 0) / 100, currency)}`}
          </Text>
        </Card>
      ) : (
        <View style={{ gap: 6 }}>
          <Text variant="label">Which payment</Text>
          {choices.length === 0 ? (
            <Text variant="callout" ink="muted">Every recent payment is already settled by a receipt or skipped.</Text>
          ) : (
            <List>
              {choices.map((p) => (
                <Choice
                  key={p.id}
                  selected={p.id === chosenPayment}
                  onPress={() => {
                    setChosenPayment(p.id);
                    setChosenReceipt(null);
                  }}
                  title={shortDay(paymentDay(p))}
                  detail={p.status === 'paid' ? 'Marked paid' : p.status === 'missed' ? 'Not marked paid' : 'Due'}
                  amount={formatCurrency((toCents(p.expectedAmount) ?? 0) / 100, currency)}
                />
              ))}
            </List>
          )}
        </View>
      )}

      {!!payment && (
        <>
          <Field
            label="Receipt"
            value={search}
            onChangeText={setSearch}
            placeholder="Search by shop or item"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            hint={debounced ? undefined : `From ${shortDay(around!)}, ten days either side. Search to look further.`}
          />

          {!!selected && selected.problems.length > 0 && (
            <Notice tone="warn" title="This might not be the one">
              {selected.problems.map((problem) => mismatchText(problem, bill.data!.name, currency)).join(' ')}
            </Notice>
          )}

          {candidates.isPending ? (
            <Skeleton height={180} round={radius.lg} />
          ) : candidates.isError ? (
            <LoadError message={candidates.error.message} onRetry={() => void candidates.refetch()} />
          ) : ranked.length === 0 ? (
            <Text variant="callout" ink="muted" align="center" style={{ paddingVertical: space.lg }}>
              {debounced ? 'No receipts match that.' : 'No receipts from around then. Search for it instead.'}
            </Text>
          ) : (
            <List inset={72}>
              {ranked.map(({ receipt, problems }) => (
                <ReceiptChoice
                  key={receipt.id}
                  receipt={receipt}
                  fits={problems.length === 0}
                  selected={receipt.id === chosenReceipt}
                  onPress={() => {
                    selectionTick();
                    setChosenReceipt(receipt.id === chosenReceipt ? null : receipt.id);
                  }}
                />
              ))}
            </List>
          )}
          {candidates.isFetching && !candidates.isPending && <ActivityIndicator color={colors.textMuted} />}
        </>
      )}
    </SheetScreen>
  );
}

function Choice({ title, detail, amount, selected, onPress }: { title: string; detail: string; amount: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        selectionTick();
        onPress();
      }}
      accessibilityRole="radio"
      aria-checked={selected}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, minHeight: 52, backgroundColor: pressed ? colors.cardPressed : 'transparent' })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="medium">{title}</Text>
        <Text variant="footnote" ink="muted">{detail}</Text>
      </View>
      <Text variant="callout" tabular>{amount}</Text>
      <View style={{ width: 22 }}>{selected && <Check size={20} color={colors.accent} strokeWidth={2.5} />}</View>
    </Pressable>
  );
}

function ReceiptChoice({ receipt, fits, selected, onPress }: { receipt: WireReceipt; fits: boolean; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const day = receiptDay(receipt);
  const cents = toCents(receipt.totalAmount);
  const title = receipt.merchantName || 'Receipt';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      aria-checked={selected}
      accessibilityLabel={[title, cents !== null ? formatCurrency(cents / 100, receipt.currency ?? 'EUR') : null, day ? shortDay(day) : null].filter(Boolean).join(', ')}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, backgroundColor: selected ? colors.accentSoft : pressed ? colors.cardPressed : 'transparent' })}
    >
      <View style={{ width: 48, height: 48, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center' }}>
        {receipt.imageUrl
          ? <Image source={{ uri: receipt.imageUrl }} style={{ width: 48, height: 48 }} contentFit="cover" transition={150} />
          : <CategoryIcon category={receipt.category} size={22} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="callout" weight="semibold" numberOfLines={1}>{title}</Text>
        <Text variant="footnote" ink="muted" numberOfLines={1}>{[day ? shortDay(day) : null, fits ? null : "Doesn't match"].filter(Boolean).join(' · ')}</Text>
      </View>
      {cents !== null && <Text variant="callout" weight="semibold" tabular ink={fits ? 'primary' : 'muted'}>{formatCurrency(cents / 100, receipt.currency ?? 'EUR')}</Text>}
      <View style={{ width: 22 }}>{selected && <Check size={20} color={colors.accent} strokeWidth={2.5} />}</View>
    </Pressable>
  );
}
